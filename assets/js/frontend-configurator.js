const CENTER_MIN_SIZE = 120;
const DEFAULT_CENTER_INSET = 14;
const CENTER_COVER_THRESHOLD = 3;

(function ($) {
	function determinePluginBaseUrl() {
		if (window.WCPC13 && WCPC13.plugin_url) {
			return WCPC13.plugin_url;
		}

		const script = document.querySelector('script[src*="frontend-configurator.js"]');
		if (script && script.src) {
			const src = script.src.split('?')[0];
			return src.replace(/assets\/js\/frontend-configurator\.js$/, '');
		}

		return '';
	}

	const PLUGIN_URL = determinePluginBaseUrl();
	// Liste des fichiers de démonstration disponibles (vérifier qu'ils existent dans assets/demo/)
	const DEMO_IMAGE_FILES = [
		'gondolas-194835_1280.jpg',
		'photo-1633102467628-6511a5129a03.jpeg',
		'premium_photo-1663047734922-fb593d415039.jpeg',
	];

	// Utiliser la première image pour le centre
	const centerDemoName = DEMO_IMAGE_FILES[0] || '';
	// Utiliser toutes les images disponibles pour les slots (elles seront répétées si nécessaire)
	const slotDemoNames = DEMO_IMAGE_FILES.length > 0 ? DEMO_IMAGE_FILES : [centerDemoName];

	const DEMO_IMAGES = {
		center: {
			image_url: PLUGIN_URL && centerDemoName ? `${PLUGIN_URL}assets/demo/${centerDemoName}` : '',
			x: 0,
			y: 0,
			scale: 1,
			size: 280,
		},
		slots: Array.from({ length: 12 }, (_, index) => {
			// Répéter les images disponibles pour remplir les 12 slots
			const name = slotDemoNames[index % slotDemoNames.length] || centerDemoName;
			return {
				image_url: PLUGIN_URL && name ? `${PLUGIN_URL}assets/demo/${name}` : '',
				x: 0,
				y: 0,
				scale: 1,
			};
		}),
	};

	const state = {
		currentSlot: 'center',
		color: '#111111',
		slots: {},
		center: {
			attachment_id: 0,
			image_url: '',
			x: 0,
			y: 0,
			scale: 1,
			size: 180,
		},
		ringSize: 110,
		centerMax: 520,
		showNumbers: false,
		numbers: {
			color: '#222222',
			size: 32,
			distance: 0,
		},
	};

let dropzoneInstance = null;
let handsTimer = null;
let html2canvasLoader = null;
let jsPDFLoader = null;

	let livePreviewUpdateTimer = null;
	let livePreviewUpdating = false;
	let livePreviewNeedsRerun = false;
	let livePreviewSuspendCount = 0;

	function loadHtml2Canvas() {
		if (window.html2canvas) {
			return Promise.resolve(window.html2canvas);
		}

		if (!html2canvasLoader) {
			html2canvasLoader = new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
				script.async = true;

				script.onload = () => {
					if (window.html2canvas) {
						resolve(window.html2canvas);
					} else {
						reject(new Error('html2canvas introuvable'));
					}
				};

				script.onerror = () => reject(new Error('Impossible de charger html2canvas'));

				document.head.appendChild(script);
			});
		}

		return html2canvasLoader;
	}

	function loadJsPDF() {
		const constructor = () => {
			if (window.jsPDF) {
				return window.jsPDF;
			}
			if (window.jspdf && window.jspdf.jsPDF) {
				return window.jspdf.jsPDF;
			}
			return null;
		};

		const existing = constructor();
		if (existing) {
			return Promise.resolve(existing);
		}

		if (!jsPDFLoader) {
			jsPDFLoader = new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
				script.async = true;

				script.onload = () => {
					const jsPDF = constructor();
					if (jsPDF) {
						resolve(jsPDF);
					} else {
						reject(new Error('jsPDF introuvable'));
					}
				};

				script.onerror = () => reject(new Error('Impossible de charger jsPDF'));

				document.head.appendChild(script);
			});
		}

		return jsPDFLoader;
	}

	function scheduleLivePreviewUpdate() {
		if (livePreviewSuspendCount > 0 || livePreviewUpdating) {
			livePreviewNeedsRerun = true;
			return;
		}

		if (livePreviewUpdateTimer) {
			return;
		}

		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const imageEl = configurator.querySelector(selectors.livePreviewImage);
		if (!imageEl) {
			return;
		}

		livePreviewUpdateTimer = setTimeout(runLivePreviewUpdate, 300);
	}

	async function runLivePreviewUpdate() {
		livePreviewUpdateTimer = null;
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const imageEl = configurator.querySelector(selectors.livePreviewImage);
		const placeholderEl = configurator.querySelector(selectors.livePreviewPlaceholder);
		if (!imageEl) {
			return;
		}

		livePreviewUpdating = true;
		livePreviewNeedsRerun = false;

		try {
			const previousSrc = imageEl.src;
			const canvas = await capturePreview(1, { printMode: false, skipLivePreviewUpdate: true });
			const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
			if (dataUrl !== previousSrc) {
				imageEl.src = dataUrl;
			}
			if (placeholderEl) {
				placeholderEl.style.display = 'none';
			}
			imageEl.style.display = 'block';
		} catch (error) {
			if (window.WCPC13_DEBUG) {
				console.error('Live JPEG preview update failed', error);
			}
			if (placeholderEl) {
				placeholderEl.style.display = '';
			}
			imageEl.style.display = 'none';
		} finally {
			livePreviewUpdating = false;
			if (livePreviewNeedsRerun) {
				livePreviewNeedsRerun = false;
				scheduleLivePreviewUpdate();
			}
		}
	}

	function capturePreview(scale = 2, { printMode = false, skipLivePreviewUpdate = false } = {}) {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return Promise.reject(new Error('Prévisualisation introuvable'));
		}

		const previewEl = configurator.querySelector(selectors.preview);
		if (!previewEl) {
			return Promise.reject(new Error('Prévisualisation introuvable'));
		}

		// Ajouter la classe print-mode si nécessaire
		if (printMode) {
			previewEl.classList.add('print-mode');
		}

		// Attendre que les styles soient appliqués avant de récupérer les dimensions
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				// Appliquer les transformations après l'ajout éventuel de la classe print-mode
				if (skipLivePreviewUpdate) {
					livePreviewSuspendCount += 1;
				}
				applyTransforms();

				// Préparer les styles calculés de l'image centrale pour le clone html2canvas
				const centerEl = configurator.querySelector(selectors.centerImage);
				let centerComputedStyles = null;
				const centerRect = centerEl ? centerEl.getBoundingClientRect() : null;
				const centerWidth = centerRect ? centerRect.width : 0;
				const centerHeight = centerRect ? centerRect.height : 0;
				const centerXPercent = state.center.x || 0;
				const centerYPercent = state.center.y || 0;
				const centerScaleValue = state.center.scale || 1;
				let centerBackgroundSize = '';
				let centerBackgroundPosition = '';
				let centerTransformOrigin = '';

				if (centerEl && state.center.image_url) {
					centerComputedStyles = window.getComputedStyle(centerEl);
					centerBackgroundSize = centerComputedStyles.backgroundSize || '';
					centerBackgroundPosition = centerComputedStyles.backgroundPosition || '';
					centerTransformOrigin = centerComputedStyles.transformOrigin || '';
				}
				const centerWrapper = configurator.querySelector(selectors.center);
				const centerWrapperRect = centerWrapper ? centerWrapper.getBoundingClientRect() : null;
				const previewRect = previewEl.getBoundingClientRect();

				if (window.WCPC13_DEBUG && centerEl && centerRect) {
					console.groupCollapsed('🪞 DEBUG capturePreview - Etat live avant clone');
					console.log('scale', scale);
					console.log('state.center', { ...state.center });
					console.log('centerWidth', centerWidth);
					console.log('centerHeight', centerHeight);
					console.log('transformOrigin', centerTransformOrigin);
					console.log('backgroundSize', centerBackgroundSize);
					console.log('backgroundPosition', centerBackgroundPosition);
					console.log('centerRect', {
						left: centerRect.left.toFixed(2),
						top: centerRect.top.toFixed(2),
						width: centerRect.width.toFixed(2),
						height: centerRect.height.toFixed(2),
					});
					if (cloneRect) {
						console.log('cloneRect', {
							left: cloneRect.left.toFixed(2),
							top: cloneRect.top.toFixed(2),
							width: cloneRect.width.toFixed(2),
							height: cloneRect.height.toFixed(2),
						});
					}
					console.groupEnd();
				}

				// Attendre que les styles soient appliqués avant la capture

				loadHtml2Canvas()
					.then((html2canvas) => {
						return html2canvas(previewEl, {
							scale: scale,
							backgroundColor: '#ffffff',
							useCORS: true,
							allowTaint: false,
							logging: false,
							removeContainer: true,
							imageTimeout: 8000,
							foreignObjectRendering: false,
							onclone: (clonedDoc) => {
								// S'assurer que le transform de l'image centrale est identique dans le clone
								const clonedCenterEl = clonedDoc.querySelector('.wc-pc13-center-image');
								const clonedCenterWrapper = clonedDoc.querySelector('.wc-pc13-center');

								if (clonedCenterEl && state.center.image_url && centerRect && previewRect) {
									const width = centerRect.width;
									const height = centerRect.height;
									let offsetLeft = 0;
									let offsetTop = 0;
									if (centerWrapperRect) {
										offsetLeft = centerRect.left - centerWrapperRect.left;
										offsetTop = centerRect.top - centerWrapperRect.top;
									}
									clonedCenterEl.style.transform = 'none';
									clonedCenterEl.style.left = `${offsetLeft * scale}px`;
									clonedCenterEl.style.top = `${offsetTop * scale}px`;
									clonedCenterEl.style.width = `${width * scale}px`;
									clonedCenterEl.style.height = `${height * scale}px`;
									clonedCenterEl.style.margin = '0';
									clonedCenterEl.style.inset = 'auto';
									clonedCenterEl.style.position = 'absolute';
									if (centerBackgroundSize) {
										clonedCenterEl.style.backgroundSize = centerBackgroundSize;
									}
									if (centerBackgroundPosition) {
										clonedCenterEl.style.backgroundPosition = centerBackgroundPosition;
									}
									if (centerTransformOrigin) {
										clonedCenterEl.style.transformOrigin = centerTransformOrigin;
									}
									if (clonedCenterWrapper && centerWrapperRect) {
										const wrapperLeft = centerWrapperRect.left - previewRect.left;
										const wrapperTop = centerWrapperRect.top - previewRect.top;
										clonedCenterWrapper.style.transform = 'none';
										clonedCenterWrapper.style.left = `${wrapperLeft * scale}px`;
										clonedCenterWrapper.style.top = `${wrapperTop * scale}px`;
										clonedCenterWrapper.style.width = `${centerWrapperRect.width * scale}px`;
										clonedCenterWrapper.style.height = `${centerWrapperRect.height * scale}px`;
										clonedCenterWrapper.style.margin = '0';
										clonedCenterWrapper.style.position = 'absolute';
									}
									if (window.WCPC13_DEBUG) {
										const cloneRect = clonedCenterEl.getBoundingClientRect();
										console.groupCollapsed('🪞 DEBUG capturePreview - Clone html2canvas');
										console.log('applied transform', clonedCenterEl.style.transform);
										console.log('transformOrigin', clonedCenterEl.style.transformOrigin);
										console.log('backgroundSize', clonedCenterEl.style.backgroundSize);
										console.log('backgroundPosition', clonedCenterEl.style.backgroundPosition);
										if (cloneRect) {
											console.log('cloneRect', {
												left: cloneRect.left.toFixed(2),
												top: cloneRect.top.toFixed(2),
												width: cloneRect.width.toFixed(2),
												height: cloneRect.height.toFixed(2),
											});
										}
										console.groupEnd();
									}
								}
							}
						});
					})
					.then((canvas) => {
						resolve(canvas);
					})
					.catch((error) => {
						reject(error);
					})
					.finally(() => {
						if (printMode) {
							previewEl.classList.remove('print-mode');
						}
						if (skipLivePreviewUpdate) {
							livePreviewSuspendCount = Math.max(0, livePreviewSuspendCount - 1);
							if (livePreviewSuspendCount === 0 && livePreviewNeedsRerun) {
								livePreviewNeedsRerun = false;
								scheduleLivePreviewUpdate();
							}
						}
					});
			}, 50);
		});
	}

	function canvasToJpegBlob(canvas, quality = 0.92) {
		return new Promise((resolve, reject) => {
			if (!canvas) {
				reject(new Error(WCPC13?.labels?.preview_error || 'Prévisualisation indisponible'));
				return;
			}
			canvas.toBlob((blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error(WCPC13?.labels?.preview_error || 'Prévisualisation indisponible'));
				}
			}, 'image/jpeg', quality);
		});
	}

	async function generateThumbnail(scale = 1, quality = 0.85) {
		// Génère une vignette de l'horloge telle qu'elle est affichée
		try {
			const canvas = await capturePreview(scale, { printMode: false, skipLivePreviewUpdate: true });
			const dataUrl = canvas.toDataURL('image/jpeg', quality);
			return dataUrl;
		} catch (error) {
			console.error('Erreur lors de la génération de la vignette:', error);
			return null;
		}
	}

	async function uploadPreviewForCart() {
		const previewIdInput = document.querySelector(selectors.previewIdInput);
		const previewUrlInput = document.querySelector(selectors.previewUrlInput);

		if (!previewIdInput && !previewUrlInput) {
			return null;
		}

		// Capturer l'image telle qu'elle est affichée (comme downloadAsJpeg)
		try {
			// Utiliser la même méthode que downloadAsJpeg pour capturer l'image correctement
			const canvas = await capturePreview(2, { printMode: false, skipLivePreviewUpdate: true });
			const blob = await canvasToJpegBlob(canvas, 0.92);

			const formData = new FormData();
			formData.append('action', 'wc_pc13_upload_preview');
			formData.append('nonce', WCPC13.nonce);
			formData.append('preview', blob, `wc-pc13-preview-${Date.now()}.jpg`);

			const response = await fetch(WCPC13.ajax_url, {
				method: 'POST',
				credentials: 'same-origin',
				body: formData,
			});

			if (!response.ok) {
				throw new Error(WCPC13.labels.preview_error || 'Téléchargement impossible');
			}

			const data = await response.json();
			if (!data || !data.success || !data.data) {
				throw new Error((data && data.data && data.data.message) || WCPC13.labels.preview_error || 'Téléchargement impossible');
			}

			if (previewIdInput) {
				previewIdInput.value = data.data.attachment_id || '';
			}
			if (previewUrlInput) {
				previewUrlInput.value = data.data.url || '';
			}

			return data.data;
		} catch (error) {
			throw error;
		}
	}

	function downloadAsJpeg() {
		// Capturer la prévisualisation à la résolution affichée (scale 1)
		capturePreview(1, { printMode: false, skipLivePreviewUpdate: true })
			.then((canvas) => {
				// Convertir le canvas en JPEG
				const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

				// Créer un lien de téléchargement
				const link = document.createElement('a');
				link.href = dataUrl;
				link.download = `horloge-personnalisee-${Date.now()}.jpg`;

				// Déclencher le téléchargement
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			})
			.catch((error) => {
				console.error('Erreur lors du téléchargement JPEG:', error);
				const errorMessage = error?.message || WCPC13?.labels?.download_error || 'Téléchargement impossible';
				window.alert(errorMessage);
			});
	}

	function pxToMm(px) {
		return (px * 25.4) / 96;
	}

	async function loadImageAsset(url) {
		if (!url) {
			return null;
		}

		const attemptLoad = (source, onError) =>
			new Promise((resolve) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.decoding = 'async';
				img.onload = () => resolve(img);
				img.onerror = async () => {
					if (onError) {
						const fallback = await onError();
						resolve(fallback);
					} else {
						resolve(null);
					}
				};
				img.src = source;
			});

		return attemptLoad(url, async () => {
			try {
				const response = await fetch(url, { credentials: 'same-origin' });
				if (!response.ok) {
					return null;
				}
				const blob = await response.blob();
				const objectURL = URL.createObjectURL(blob);
				const loaded = await attemptLoad(objectURL);
				URL.revokeObjectURL(objectURL);
				return loaded;
			} catch (error) {
				console.error('Failed to fetch image asset', error);
				return null;
			}
		});
	}

	function getRingRadiusValue(baseSize) {
		const size = state.ringSize;
		return Math.max((baseSize / 2) - (size / 2) - 12, 50);
	}

	function drawCircularImage(ctx, centerX, centerY, diameter, image, transformState) {
		if (!image) {
			return;
		}

		const radius = diameter / 2;
		ctx.save();
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();

		ctx.save();
		ctx.translate(centerX - radius, centerY - radius);

		const baseSize = diameter;
		const scale = Math.max(baseSize / image.naturalWidth, baseSize / image.naturalHeight) * (transformState?.scale || 1);
		const drawWidth = image.naturalWidth * scale;
		const drawHeight = image.naturalHeight * scale;
		const translateX = ((transformState?.x || 0) / 100) * baseSize;
		const translateY = ((transformState?.y || 0) / 100) * baseSize;
		const offsetX = (baseSize - drawWidth) / 2 + translateX;
		const offsetY = (baseSize - drawHeight) / 2 + translateY;

		ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

		ctx.restore();
		ctx.restore();
	}

	async function buildHighResPdfCanvas() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			throw new Error('Configurateur introuvable');
		}

		const preview = configurator.querySelector(selectors.preview);
		if (!preview) {
			throw new Error('Prévisualisation introuvable');
		}

		const baseSize = preview.offsetWidth || 360;
		const outputSize = Math.max(4096, Math.ceil(baseSize * 4));
		const scaleFactor = outputSize / baseSize;
		const ringRadiusScreen = getRingRadiusValue(baseSize);
		const ringRadius = ringRadiusScreen * scaleFactor;
		const slotSize = state.ringSize * scaleFactor;
		// Respecter la taille actuelle du visuel central
		const centerSizeFromState = Number.isFinite(state.center.size) && state.center.size > 0 ? state.center.size : CENTER_MIN_SIZE;
		const centerSize = centerSizeFromState * scaleFactor;
		const numbersDistanceScreen = (typeof state.numbers.distance === 'number' && state.numbers.distance > 0)
			? state.numbers.distance
			: ringRadiusScreen;
		const numbersRadius = numbersDistanceScreen * scaleFactor;

		const canvas = document.createElement('canvas');
		canvas.width = outputSize;
		canvas.height = outputSize;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, outputSize, outputSize);

		const centerX = outputSize / 2;
		const centerY = outputSize / 2;

		// Récupérer les informations DOM actuelles pour chaque vignette (fallback si l'état est incomplet)
		const slotEntries = [];
		const slotDomMap = new Map();
		configurator.querySelectorAll(`${selectors.slot}[data-slot]`).forEach((slotEl) => {
			const index = parseInt(slotEl.dataset.slot, 10);
			if (!index) {
				return;
			}
			const imageEl = slotEl.querySelector(selectors.slotImage);
			if (!imageEl) {
				return;
			}
			const styles = window.getComputedStyle(imageEl);
			const backgroundImage = styles.backgroundImage || '';
			let imageUrl = '';
			const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
			if (match && match[1]) {
				imageUrl = match[1];
			}
			const zoom = parseFloat(imageEl.dataset.zoom || slotEl.dataset.zoom || '1');
			const axisX = parseFloat(imageEl.dataset.axisX || slotEl.dataset.axisX || '0');
			const axisY = parseFloat(imageEl.dataset.axisY || slotEl.dataset.axisY || '0');
			slotDomMap.set(index, {
				imageUrl,
				x: axisX,
				y: axisY,
				scale: zoom,
			});
		});

		for (let i = 1; i <= 12; i++) {
			if (!state.slots[i]) {
				state.slots[i] = {
					attachment_id: 0,
					image_url: '',
					x: 0,
					y: 0,
					scale: 1,
				};
			}
			const domInfo = slotDomMap.get(i) || {};
			const resolvedUrl = state.slots[i].image_url || domInfo.imageUrl || '';
			const resolvedTransform = {
				x: typeof domInfo.x === 'number' ? domInfo.x : state.slots[i].x,
				y: typeof domInfo.y === 'number' ? domInfo.y : state.slots[i].y,
				scale: typeof domInfo.scale === 'number' && domInfo.scale > 0 ? domInfo.scale : state.slots[i].scale,
			};
			slotEntries.push({
				index: i,
				state: {
					...state.slots[i],
					...resolvedTransform,
				},
				imageUrl: resolvedUrl,
			});
		}

		const slotImages = await Promise.all(
			slotEntries.map((entry) => (entry.imageUrl ? loadImageAsset(entry.imageUrl) : Promise.resolve(null)))
		);

		let centerImageUrl = state.center?.image_url || '';
		let centerTransformFallback = { ...state.center };
		const centerImageEl = configurator.querySelector(selectors.centerImage);
		if (!centerImageUrl && centerImageEl) {
			const styles = window.getComputedStyle(centerImageEl);
			const bg = styles.backgroundImage || '';
			const match = bg.match(/url\(["']?(.*?)["']?\)/);
			if (match && match[1]) {
				centerImageUrl = match[1];
			}
		}
		if (centerImageEl) {
			const axisX = parseFloat(centerImageEl.dataset.axisX || '0');
			const axisY = parseFloat(centerImageEl.dataset.axisY || '0');
			const zoom = parseFloat(centerImageEl.dataset.zoom || '1');
			centerTransformFallback = {
				...centerTransformFallback,
				x: axisX,
				y: axisY,
				scale: zoom,
			};
		}
		const centerImage = centerImageUrl ? await loadImageAsset(centerImageUrl) : null;

		slotEntries.forEach((entry, idx) => {
			const image = slotImages[idx];
			if (!image) {
				return;
			}
			const angleDeg = (entry.index % 12) * 30;
			const angleRad = (angleDeg * Math.PI) / 180;
			const slotCenterX = centerX + Math.sin(angleRad) * ringRadius;
			const slotCenterY = centerY - Math.cos(angleRad) * ringRadius;

			drawCircularImage(ctx, slotCenterX, slotCenterY, slotSize, image, entry.state);
		});

		if (centerImage) {
			drawCircularImage(ctx, centerX, centerY, centerSize, centerImage, centerTransformFallback);
		}

		if (state.showNumbers) {
			ctx.save();
			ctx.fillStyle = state.numbers.color || '#222222';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const fontSizePx = Math.max(12, state.numbers.size || 32) * scaleFactor;
			ctx.font = `${Math.round(fontSizePx)}px "Helvetica Neue", "Arial", sans-serif`;
			for (let i = 1; i <= 12; i++) {
				const angleDeg = (i % 12) * 30;
				const angleRad = (angleDeg * Math.PI) / 180;
				const numberX = centerX + Math.sin(angleRad) * numbersRadius;
				const numberY = centerY - Math.cos(angleRad) * numbersRadius;
				ctx.fillText(`${i}`, numberX, numberY);
			}
			ctx.restore();
		}

		ctx.save();
		ctx.lineWidth = Math.max(6, outputSize * 0.006);
		ctx.strokeStyle = '#111111';
		ctx.beginPath();
		ctx.arc(centerX, centerY, (outputSize / 2) - (ctx.lineWidth / 2), 0, Math.PI * 2);
		ctx.closePath();
		ctx.stroke();
		ctx.restore();

		const pdfSizeMm = pxToMm(outputSize);
		return {
			canvas,
			outputSize,
			pdfWidthMm: pdfSizeMm,
			pdfHeightMm: pdfSizeMm,
		};
	}

	async function generatePdfBlob() {
		const { canvas, pdfWidthMm, pdfHeightMm } = await buildHighResPdfCanvas();
		const jsPDF = await loadJsPDF();
		const pdf = new jsPDF({
			orientation: pdfWidthMm >= pdfHeightMm ? 'landscape' : 'portrait',
			unit: 'mm',
			format: [pdfWidthMm, pdfHeightMm],
		});
		const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
		pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
		const blob = pdf.output('blob');
		return {
			blob,
			fileName: `wc-pc13-preview-${Date.now()}.pdf`,
		};
	}

	async function uploadPdfForCart() {
		const configurator = document.querySelector(selectors.configurator);
		const pdfIdInput = configurator ? configurator.querySelector(selectors.pdfIdInput) : null;
		const pdfUrlInput = configurator ? configurator.querySelector(selectors.pdfUrlInput) : null;

		if (!pdfIdInput && !pdfUrlInput) {
			return null;
		}

		const { blob, fileName } = await generatePdfBlob();

		const formData = new FormData();
		formData.append('action', 'wc_pc13_upload_pdf');
		formData.append('nonce', WCPC13.nonce);
		formData.append('pdf', blob, fileName);

		const response = await fetch(WCPC13.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData,
		});

		if (!response.ok) {
			throw new Error(WCPC13.labels.preview_error || 'Téléchargement impossible');
		}

		const data = await response.json();
		if (!data || !data.success || !data.data) {
			throw new Error((data && data.data && data.data.message) || WCPC13.labels.preview_error || 'Téléchargement impossible');
		}

		if (pdfIdInput) {
			pdfIdInput.value = data.data.attachment_id || '';
		}
		if (pdfUrlInput) {
			pdfUrlInput.value = data.data.url || '';
		}

		return data.data;
	}

	async function downloadAsPdf() {
		try {
			const { canvas, pdfWidthMm, pdfHeightMm } = await buildHighResPdfCanvas();
			const jsPDF = await loadJsPDF();
			const pdf = new jsPDF({
				orientation: pdfWidthMm >= pdfHeightMm ? 'landscape' : 'portrait',
				unit: 'mm',
				format: [pdfWidthMm, pdfHeightMm],
			});

			const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
			pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
			pdf.save(`horloge-personnalisee-${Date.now()}.pdf`);
		} catch (error) {
			window.alert(error.message || WCPC13.labels.download_error || 'Téléchargement impossible');
		}
	}

	const selectors = {
		configurator: '.wc-pc13-configurator',
		slot: '.wc-pc13-slot',
		center: '.wc-pc13-center',
		slotImage: '.wc-pc13-slot-image',
		centerImage: '.wc-pc13-center-image',
		payload: '#wc-pc13-payload',
		previewIdInput: '#wc-pc13-preview-id',
		previewUrlInput: '#wc-pc13-preview-url',
		pdfIdInput: '#wc-pc13-pdf-id',
		pdfUrlInput: '#wc-pc13-pdf-url',
		fileInput: '.wc-pc13-slot-fields input[type="file"]',
		removeBtn: '.wc-pc13-remove',
		rangeZoom: '.wc-pc13-slot-fields input[data-zoom]',
		rangeAxis: '.wc-pc13-slot-fields input[data-axis]',
		colorInput: '#wc-pc13-color',
		slotSizeRange: '#wc-pc13-slot-size',
		numbersToggle: '#wc-pc13-show-numbers',
		numbersColor: '#wc-pc13-number-color',
		numbersSize: '#wc-pc13-number-size',
		numbersDistance: '#wc-pc13-number-distance',
		numbersFields: '.wc-pc13-numbers-fields',
		centerSelectButton: '.wc-pc13-select-center',
		centerRemoveButton: '.wc-pc13-remove-center',
		centerPanel: '.wc-pc13-center-panel',
		customAddToCart: '.wc-pc13-add-to-cart-btn',
		centerSizeRange: '#wc-pc13-center-size',
		slotFields: '.wc-pc13-slot-fields',
		preview: '.wc-pc13-preview',
		downloadJpeg: '.wc-pc13-download-jpeg',
		downloadPdf: '.wc-pc13-download-pdf',
		livePreviewImage: '.wc-pc13-live-preview-image',
		livePreviewPlaceholder: '.wc-pc13-live-preview-placeholder',
		fillDemo: '.wc-pc13-fill-demo',
		fillUnsplash: '.wc-pc13-fill-unsplash',
	};

	function updateRingDimensions() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const preview = configurator.querySelector('.wc-pc13-preview');
		if (!preview) {
			return;
		}

		const size = state.ringSize;
		const previewWidth = preview.offsetWidth || 360;
		const radius = Math.max((previewWidth / 2) - (size / 2) - 12, 50);

		preview.style.setProperty('--slot-size', `${size}px`);
		preview.style.setProperty('--ring-radius', `${radius}px`);

		state.currentRingRadius = radius;
		if (typeof state.numbers.distance !== 'number' || state.numbers.distance <= 0) {
			state.numbers.distance = radius;
		}

		updateCenterSizeLimits(configurator, preview);
	}

	function updateCenterSizeLimits(configuratorParam, previewParam) {
		const configurator = configuratorParam || document.querySelector(selectors.configurator);
		if (!configurator) {
			return false;
		}

		const preview = previewParam || configurator.querySelector(selectors.preview);
		const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);

		if (!preview || !centerSizeRange) {
			return false;
		}

		const computedWidth = preview.offsetWidth || 360;
		const computedHeight = preview.offsetHeight || computedWidth;
		const maxSize = Math.round(Math.max(computedWidth, computedHeight));

		state.centerMax = Math.max(CENTER_MIN_SIZE, maxSize);
		centerSizeRange.max = state.centerMax;

		const previous = state.center.size;
		if (state.center.size > state.centerMax) {
			state.center.size = state.centerMax;
		}

		centerSizeRange.value = state.center.size;
		return previous !== state.center.size;
	}

	function initSlots() {
		for (let i = 1; i <= 12; i++) {
			state.slots[i] = {
				attachment_id: 0,
				image_url: '',
				x: 0,
				y: 0,
				scale: 1,
			};
		}
	}

	function getCurrentSlotState() {
		if (state.currentSlot === 'center') {
			return state.center;
		}
		return state.slots[state.currentSlot];
	}

	function applyTransforms() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const previewEl = configurator.querySelector(selectors.preview);
		if (previewEl) {
			previewEl.classList.toggle('show-numbers', !!state.showNumbers);
		}

		updateRingDimensions();

		Object.keys(state.slots).forEach((key) => {
			const slotState = state.slots[key];
			const slot = configurator.querySelector(`${selectors.slot}[data-slot="${key}"] ${selectors.slotImage}`);
			const slotInner = configurator.querySelector(`${selectors.slot}[data-slot="${key}"] .wc-pc13-slot-inner`);
			if (!slot) {
				return;
			}

			if (slotState.image_url) {
				slot.style.backgroundImage = `url(${slotState.image_url})`;
				slot.classList.remove('empty');
				if (slotInner) {
					slotInner.classList.add('has-image');
				}
			} else {
				slot.style.backgroundImage = '';
				slot.classList.add('empty');
				if (slotInner) {
					slotInner.classList.remove('has-image');
				}
			}

			slot.style.transform = `translate(${slotState.x}%, ${slotState.y}%) scale(${slotState.scale})`;
			slot.dataset.axisX = slotState.x;
			slot.dataset.axisY = slotState.y;
			slot.dataset.zoom = slotState.scale;
			if (slotInner) {
				slotInner.dataset.axisX = slotState.x;
				slotInner.dataset.axisY = slotState.y;
				slotInner.dataset.zoom = slotState.scale;
			}
		});

		const centerWrapper = configurator.querySelector(selectors.center);
		if (centerWrapper) {
			const sizePx = `${state.center.size}px`;
			centerWrapper.style.setProperty('--center-size', sizePx);
			centerWrapper.style.width = sizePx;
			centerWrapper.style.height = sizePx;
			if (state.center.image_url) {
				centerWrapper.classList.add('has-image');
			} else {
				centerWrapper.classList.remove('has-image');
			}
			const maxSize = state.centerMax || state.center.size;
			const isCover = state.center.size >= (maxSize - CENTER_COVER_THRESHOLD);
			centerWrapper.classList.toggle('wc-pc13-center-cover', isCover);
			const insetValue = isCover ? 0 : DEFAULT_CENTER_INSET;
			centerWrapper.style.setProperty('--center-inset', `${insetValue}px`);
		}

		const centerEl = configurator.querySelector(selectors.centerImage);
		if (centerEl) {
			if (state.center.image_url) {
				centerEl.style.backgroundImage = `url(${state.center.image_url})`;
				centerEl.classList.remove('empty');

				// Utiliser transform comme avant pour l'affichage normal
				// Les valeurs x et y sont en pourcentage, où 0 = centre
				const x = state.center.x || 0;
				const y = state.center.y || 0;
				const scale = state.center.scale || 1;
				centerEl.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
				centerEl.dataset.axisX = x;
				centerEl.dataset.axisY = y;
				centerEl.dataset.zoom = scale;

				// Debug: afficher les valeurs dans la console
				if (window.WCPC13_DEBUG) {
					console.log('Center image position:', { x, y, scale, element: centerEl });
				}
			} else {
				centerEl.style.backgroundImage = '';
				centerEl.classList.add('empty');
				centerEl.style.transform = 'none';
				delete centerEl.dataset.axisX;
				delete centerEl.dataset.axisY;
				delete centerEl.dataset.zoom;
			}
		}

		scheduleLivePreviewUpdate();

		const labels = configurator.querySelectorAll(`${selectors.slot} .wc-pc13-slot-label`);
		const ringRadius = state.currentRingRadius || 0;
		const numbersDistance = (typeof state.numbers.distance === 'number' && state.numbers.distance > 0) ? state.numbers.distance : ringRadius;
		const numbersDelta = numbersDistance - ringRadius;

		labels.forEach((label) => {
			label.style.setProperty('--numbers-color', state.numbers.color);
			label.style.setProperty('--numbers-size', `${state.numbers.size}px`);
			label.style.setProperty('--numbers-offset', `${numbersDelta}px`);
		});
	}

	function updateSelectionUI() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		configurator.querySelectorAll(`${selectors.slot}, ${selectors.center}`).forEach((el) => {
			el.classList.remove('active');
		});

		let active;
		if (state.currentSlot === 'center') {
			active = configurator.querySelector(selectors.center);
		} else {
			active = configurator.querySelector(`${selectors.slot}[data-slot="${state.currentSlot}"]`);
		}

		if (active) {
			active.classList.add('active');
		}

		const current = getCurrentSlotState();
		const zoomRange = configurator.querySelector(selectors.rangeZoom);
		const axisRanges = configurator.querySelectorAll(selectors.rangeAxis);
		const fileInput = configurator.querySelector(selectors.fileInput);
		const removeBtn = configurator.querySelector(selectors.removeBtn);
		const slotSizeRange = configurator.querySelector(selectors.slotSizeRange);
		const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
		const slotFields = configurator.querySelector(selectors.slotFields);
		const centerPanel = configurator.querySelector(selectors.centerPanel);

		if (zoomRange) {
			zoomRange.value = current.scale;
		}

		axisRanges.forEach((range) => {
			const axis = range.dataset.axis;
			if ('x' === axis) {
				range.value = current.x;
			} else if ('y' === axis) {
				range.value = current.y;
			}
		});

		if (fileInput) {
			fileInput.value = '';
		}

		if (removeBtn) {
			removeBtn.disabled = !current.image_url;
		}

		if (slotSizeRange) {
			slotSizeRange.value = state.ringSize;
		}

		if (centerSizeRange) {
			centerSizeRange.disabled = !state.center.image_url;
			centerSizeRange.value = state.center.size;
		}

		const numbersToggle = configurator.querySelector(selectors.numbersToggle);
		const numbersFields = configurator.querySelector(selectors.numbersFields);
		const numbersColor = configurator.querySelector(selectors.numbersColor);
		const numbersSize = configurator.querySelector(selectors.numbersSize);
		const numbersDistanceInput = configurator.querySelector(selectors.numbersDistance);
		const centerRemoveBtn = configurator.querySelector(selectors.centerRemoveButton);
		if (numbersToggle) {
			numbersToggle.checked = !!state.showNumbers;
		}
		const numbersEnabled = !!state.showNumbers;

		if (numbersFields) {
			numbersFields.classList.toggle('is-active', numbersEnabled);
		}

		if (numbersColor) {
			numbersColor.value = state.numbers.color;
			numbersColor.disabled = !numbersEnabled;
		}

		if (numbersSize) {
			numbersSize.value = state.numbers.size;
			numbersSize.disabled = !numbersEnabled;
		}

		if (numbersDistanceInput) {
			if (state.currentRingRadius) {
				const maxDistance = Math.max(state.currentRingRadius + state.ringSize, state.center.size);
				numbersDistanceInput.min = '0';
				numbersDistanceInput.max = `${Math.round(maxDistance * 1.2)}`;
			}
			numbersDistanceInput.value = Math.max(0, state.numbers.distance);
			numbersDistanceInput.disabled = !numbersEnabled;
		}

		if (centerRemoveBtn) {
			centerRemoveBtn.disabled = !state.center.image_url;
		}

		if (centerPanel) {
			centerPanel.classList.add('is-active');
		}
	}

	function savePayload() {
		const payloadInput = document.querySelector(selectors.payload);
		if (!payloadInput) {
			return;
		}

		const payload = {
			color: state.color,
			slots: state.slots,
			center: state.center,
			ring_size: state.ringSize,
			show_numbers: state.showNumbers,
			numbers: state.numbers,
		};

		payloadInput.value = JSON.stringify(payload);
	}

	function selectSlot(slot) {
		state.currentSlot = slot;
		updateSelectionUI();
	}

	function bindSlotClicks() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		configurator.querySelectorAll(selectors.slot).forEach((slot) => {
			// Gérer le clic sur le slot (y compris les slots vides)
			slot.addEventListener('click', (event) => {
				// Permettre le clic sur le slot ou son contenu interne
				const value = parseInt(slot.dataset.slot, 10);
				if (!isNaN(value)) {
					selectSlot(value);
				}
			});

			// Gérer le clic sur le slot-inner (pour les slots vides)
			const slotInner = slot.querySelector('.wc-pc13-slot-inner');
			if (slotInner) {
				slotInner.addEventListener('click', (event) => {
					event.stopPropagation();
					const value = parseInt(slot.dataset.slot, 10);
					if (!isNaN(value)) {
						selectSlot(value);
					}
				});
			}

			// Gérer le clic sur l'image du slot
			const slotImage = slot.querySelector(selectors.slotImage);
			if (slotImage) {
				slotImage.addEventListener('click', (event) => {
					event.stopPropagation();
					const value = parseInt(slot.dataset.slot, 10);
					if (!isNaN(value)) {
						selectSlot(value);
					}
				});
			}
		});

		const center = configurator.querySelector(selectors.center);
		if (center) {
			center.addEventListener('click', (event) => {
				// Ne pas sélectionner si on a cliqué sur l'image (elle gère son propre clic)
				if (event.target === center || !event.target.closest(selectors.centerImage)) {
					selectSlot('center');
				}
			});
		}
	}

	function uploadFile(slot, file) {
		return new Promise((resolve, reject) => {
			const formData = new FormData();
			formData.append('action', 'wc_pc13_upload_image');
			formData.append('nonce', WCPC13.nonce);
			formData.append('file', file);
			formData.append('slot', slot);

			fetch(WCPC13.ajax_url, {
				method: 'POST',
				credentials: 'same-origin',
				body: formData,
			})
				.then((response) => response.json())
				.then((data) => {
					if (data.success) {
						resolve(data.data);
					} else {
						reject(data.data && data.data.message ? data.data.message : WCPC13.labels.upload_error);
					}
				})
				.catch(() => reject(WCPC13.labels.upload_error));
		});
	}

	function applyUploadedImage(data) {
		if (!data) {
			return;
		}

		const target = getCurrentSlotState();
		target.attachment_id = data.attachment_id || 0;
		target.image_url = data.url || '';
		target.x = 0;
		target.y = 0;
		target.scale = 1;

		if (state.currentSlot === 'center') {
			const configurator = document.querySelector(selectors.configurator);
			const centerSizeRange = configurator ? configurator.querySelector(selectors.centerSizeRange) : null;
			const centerMax = state.centerMax || (centerSizeRange ? parseInt(centerSizeRange.max || `${state.center.size}`, 10) : state.center.size);
			if (centerMax) {
				target.size = centerMax;
				if (centerSizeRange) {
					centerSizeRange.value = centerMax;
				}
			}
		}

		applyTransforms();
		updateSelectionUI();
		savePayload();
	}

	function deleteAttachment(attachmentId) {
		if (!attachmentId) {
			return Promise.resolve();
		}

		const formData = new FormData();
		formData.append('action', 'wc_pc13_delete_image');
		formData.append('nonce', WCPC13.nonce);
		formData.append('attachment_id', attachmentId);

		return fetch(WCPC13.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData,
		}).then(() => undefined);
	}

function processFile(file, inputEl) {
	if (!file) {
		return;
	}

		const maxBytes = WCPC13.settings && WCPC13.settings.max_upload_bytes ? parseInt(WCPC13.settings.max_upload_bytes, 10) : 0;
		if (maxBytes && file.size > maxBytes) {
			window.alert(WCPC13.labels.file_too_large);
		if (inputEl) {
			inputEl.value = '';
		}
			return;
		}

		const slotKey = state.currentSlot;

		uploadFile(slotKey, file)
			.then((response) => {
				applyUploadedImage(response);
			})
			.catch((error) => {
				window.alert(error);
			});
		if (inputEl) {
			inputEl.value = '';
		}
	}

function handleFileChange(event) {
	const file = event.target.files[0];
	if (!file) {
		return;
	}

	processFile(file, event.target);
}

	function handleRemove() {
		const current = getCurrentSlotState();
		const attachmentId = current.attachment_id;
		deleteAttachment(attachmentId).finally(() => {
			current.attachment_id = 0;
			current.image_url = '';
			current.x = 0;
			current.y = 0;
			current.scale = 1;
			applyTransforms();
			updateSelectionUI();
			savePayload();
		});
	}

	function handleZoomChange(event) {
		const current = getCurrentSlotState();
		current.scale = parseFloat(event.target.value);
		applyTransforms();
		savePayload();
	}

	function handleAxisChange(event) {
		const axis = event.target.dataset.axis;
		const current = getCurrentSlotState();
		if ('x' === axis) {
			current.x = parseFloat(event.target.value);
		} else if ('y' === axis) {
			current.y = parseFloat(event.target.value);
		}
		applyTransforms();
		savePayload();
	}

	function handleRingSizeChange(event) {
		state.ringSize = parseInt(event.target.value, 10);
	applyTransforms();
	updateSelectionUI();
		savePayload();
	}

function handleCenterSizeChange(event) {
	const value = parseInt(event.target.value, 10);
	if (Number.isNaN(value)) {
		return;
	}

	const maxSize = state.centerMax || parseInt(event.target.getAttribute('max') || `${value}`, 10);
	state.center.size = Math.max(CENTER_MIN_SIZE, Math.min(maxSize, value));
	applyTransforms();
	savePayload();
}

function handleNumbersToggle(event) {
	state.showNumbers = !!event.target.checked;
	updateSelectionUI();
	applyTransforms();
		savePayload();
}

function handleNumbersColorChange(event) {
	const value = event.target.value;
	state.numbers.color = value || '#222222';
	applyTransforms();
	savePayload();
}

function handleNumbersSizeChange(event) {
	const value = parseInt(event.target.value, 10);
	if (Number.isNaN(value)) {
		return;
	}
	state.numbers.size = Math.max(12, Math.min(96, value));
	applyTransforms();
	savePayload();
}

function handleNumbersDistanceChange(event) {
	const value = parseInt(event.target.value, 10);
	if (Number.isNaN(value)) {
		return;
	}
	const ringRadius = state.currentRingRadius || 0;
	const maxAttr = parseInt(event.target.getAttribute('max'), 10);
	const maxDistance = Number.isNaN(maxAttr) ? Math.max(ringRadius + state.ringSize, state.center.size) : maxAttr;
	const clamped = Math.max(0, Math.min(maxDistance, value));
	state.numbers.distance = clamped;
	applyTransforms();
	updateSelectionUI();
	savePayload();
}

	function initCustomAddToCart() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const customBtn = document.querySelector(selectors.customAddToCart);
		if (!customBtn) {
			return;
		}

		const form = customBtn.closest('form');
		if (!form) {
			return;
		}

		const nativeBtn = form.querySelector('.single_add_to_cart_button');

		const syncState = () => {
			if (!nativeBtn) {
				customBtn.disabled = false;
				customBtn.classList.remove('is-disabled');
				customBtn.classList.remove('is-loading');
				return;
			}
			const isDisabled = nativeBtn.disabled || nativeBtn.classList.contains('disabled');
			customBtn.disabled = isDisabled;
			customBtn.classList.toggle('is-disabled', isDisabled);
			if (!isDisabled) {
				customBtn.classList.remove('is-loading');
			}
		};

		if (nativeBtn) {
			nativeBtn.classList.add('wc-pc13-native-button');
			nativeBtn.setAttribute('aria-hidden', 'true');
			nativeBtn.setAttribute('tabindex', '-1');

			syncState();

			const observer = new MutationObserver(syncState);
			observer.observe(nativeBtn, { attributes: true, attributeFilter: ['disabled', 'class'] });
			form.addEventListener('change', syncState);
		} else {
			customBtn.disabled = false;
			customBtn.classList.remove('is-disabled');
		}

		customBtn.addEventListener('click', async (event) => {
			event.preventDefault();
			if (customBtn.disabled || customBtn.classList.contains('is-loading')) {
				return;
			}

			customBtn.classList.add('is-loading');
			customBtn.disabled = true;

			try {
				savePayload();
				await uploadPreviewForCart();
				await uploadPdfForCart();

				// Générer une vignette pour la notification
				const thumbnailDataUrl = await generateThumbnail(1, 0.85);

				// Récupérer les données du formulaire
				const productId = configurator ? parseInt(configurator.dataset.product, 10) : 0;
				const payloadInput = document.querySelector(selectors.payload);
				const previewIdInput = document.querySelector(selectors.previewIdInput);
				const previewUrlInput = document.querySelector(selectors.previewUrlInput);
				const pdfIdInput = document.querySelector(selectors.pdfIdInput);
				const pdfUrlInput = document.querySelector(selectors.pdfUrlInput);

				const formData = new FormData();
				formData.append('action', 'wc_pc13_add_to_cart');
				formData.append('nonce', WCPC13.nonce);
				formData.append('product_id', productId);
				formData.append('quantity', 1);

				if (payloadInput && payloadInput.value) {
					formData.append('payload', payloadInput.value);
				}
				if (previewIdInput && previewIdInput.value) {
					formData.append('preview_id', previewIdInput.value);
				}
				if (previewUrlInput && previewUrlInput.value) {
					formData.append('preview_url', previewUrlInput.value);
				}
				if (pdfIdInput && pdfIdInput.value) {
					formData.append('pdf_id', pdfIdInput.value);
				}
				if (pdfUrlInput && pdfUrlInput.value) {
					formData.append('pdf_url', pdfUrlInput.value);
				}

				const response = await fetch(WCPC13.ajax_url, {
					method: 'POST',
					credentials: 'same-origin',
					body: formData,
				});

				if (!response.ok) {
					throw new Error(WCPC13.labels.preview_error || 'Erreur lors de l\'ajout au panier');
				}

				const data = await response.json();
				if (!data || !data.success) {
					throw new Error(data?.data?.message || WCPC13.labels.preview_error || 'Erreur lors de l\'ajout au panier');
				}

				// Utiliser la vignette générée ou l'URL de prévisualisation
				const notificationData = {
					...data.data,
					preview_url: thumbnailDataUrl || data.data.preview_url || ''
				};

				// Afficher la notification
				showAddToCartNotification(notificationData);

				// Réactiver le bouton
				customBtn.disabled = false;
				customBtn.classList.remove('is-loading');

				// Déclencher l'événement WooCommerce pour mettre à jour le panier
				if (typeof jQuery !== 'undefined' && jQuery.fn.trigger) {
					jQuery(document.body).trigger('added_to_cart', [data.data.fragments || {}, data.data.cart_hash || '', jQuery(customBtn)]);
				}

			} catch (error) {
				console.error(error);
				window.alert(error?.message || WCPC13.labels.preview_error || 'Erreur lors de l\'ajout au panier');
				customBtn.disabled = false;
				customBtn.classList.remove('is-loading');
			}
		});
	}

	function bindControls() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const fileInput = configurator.querySelector(selectors.fileInput);
		const removeBtn = configurator.querySelector(selectors.removeBtn);
		const zoomRange = configurator.querySelector(selectors.rangeZoom);
		const axisRanges = configurator.querySelectorAll(selectors.rangeAxis);
		const slotSizeRange = configurator.querySelector(selectors.slotSizeRange);
	const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
	const numbersToggle = configurator.querySelector(selectors.numbersToggle);
	const numbersColor = configurator.querySelector(selectors.numbersColor);
	const numbersSize = configurator.querySelector(selectors.numbersSize);
	const numbersDistanceInput = configurator.querySelector(selectors.numbersDistance);
	const centerSelectBtn = configurator.querySelector(selectors.centerSelectButton);
	const centerRemoveBtn = configurator.querySelector(selectors.centerRemoveButton);
	const uploadButton = configurator.querySelector('.wc-pc13-upload-button');
		const downloadJpegBtn = configurator.querySelector(selectors.downloadJpeg);
		const downloadPdfBtn = configurator.querySelector(selectors.downloadPdf);
		const fillDemoBtn = configurator.querySelector(selectors.fillDemo);
		const fillUnsplashBtn = configurator.querySelector(selectors.fillUnsplash);

		if (fileInput) {
			fileInput.addEventListener('change', handleFileChange);
		}

		if (removeBtn) {
			removeBtn.addEventListener('click', handleRemove);
		}

		if (zoomRange) {
			zoomRange.addEventListener('input', handleZoomChange);
		}

		axisRanges.forEach((range) => {
			range.addEventListener('input', handleAxisChange);
		});

		if (slotSizeRange) {
			slotSizeRange.addEventListener('input', handleRingSizeChange);
		}

	if (centerSizeRange) {
		centerSizeRange.addEventListener('input', handleCenterSizeChange);
	}

	if (numbersToggle) {
		numbersToggle.checked = !!state.showNumbers;
		numbersToggle.addEventListener('change', handleNumbersToggle);
	}

	if (numbersColor) {
		numbersColor.addEventListener('change', handleNumbersColorChange);
	}

	if (numbersSize) {
		numbersSize.addEventListener('input', handleNumbersSizeChange);
	}

	if (numbersDistanceInput) {
		numbersDistanceInput.addEventListener('input', handleNumbersDistanceChange);
	}

	if (centerSelectBtn) {
		centerSelectBtn.addEventListener('click', (event) => {
			event.preventDefault();
			selectSlot('center');
			const fileInput = configurator.querySelector(selectors.fileInput);
			if (fileInput) {
				fileInput.click();
			}
		});
	}

	if (centerRemoveBtn) {
		centerRemoveBtn.addEventListener('click', (event) => {
			event.preventDefault();
			if (!state.center.image_url) {
				return;
			}
			selectSlot('center');
			handleRemove();
		});
	}

	if (uploadButton && fileInput) {
		uploadButton.addEventListener('click', (event) => {
			event.preventDefault();
			fileInput.click();
		});
	}

		if (downloadJpegBtn) {
			downloadJpegBtn.addEventListener('click', (event) => {
				event.preventDefault();
				downloadAsJpeg();
			});
		}

		if (downloadPdfBtn) {
			downloadPdfBtn.addEventListener('click', (event) => {
				event.preventDefault();
				downloadAsPdf();
			});
		}

		if (fillDemoBtn) {
			fillDemoBtn.addEventListener('click', (event) => {
				event.preventDefault();
				fillDemoImages();
			});
		}

		if (fillUnsplashBtn) {
			fillUnsplashBtn.addEventListener('click', (event) => {
				event.preventDefault();
				fillUnsplashImages();
			});
		}
	}

	function bindHandsControls() {
		const colorInput = document.querySelector(selectors.colorInput);
		const handsWrapper = document.querySelector('.wc-pc13-hands');

		startHandsClock();

		if (colorInput) {
			state.color = colorInput.value;
			colorInput.addEventListener('change', (event) => {
				state.color = event.target.value;
				updateHandsColor();
				savePayload();
			});
			updateHandsColor();
		}
	}

	function updateHandsColor() {
		const color = (state.color || '#111111').toLowerCase();
		const hands = document.querySelectorAll('.wc-pc13-hand');
		const needsOutline = '#ffffff' === color;

		hands.forEach((hand) => {
			hand.style.background = color;
			hand.style.boxShadow = needsOutline ? '0 0 0 1px rgba(0, 0, 0, 0.2)' : 'none';
		});
	}

	function setHandsRotation(date) {
		const handsWrapper = document.querySelector('.wc-pc13-hands');
		if (!handsWrapper) {
			return;
		}

		const hourHand = handsWrapper.querySelector('.wc-pc13-hand.hour');
		const minuteHand = handsWrapper.querySelector('.wc-pc13-hand.minute');
		const secondHand = handsWrapper.querySelector('.wc-pc13-hand.second');

		const hours = date.getHours() % 12;
		const minutes = date.getMinutes();
		const seconds = date.getSeconds();

		const hourAngle = (hours * 30) + (minutes * 0.5);
		const minuteAngle = (minutes * 6) + (seconds * 0.1);
		const secondAngle = seconds * 6;

		if (hourHand) {
			hourHand.style.transform = `rotate(${hourAngle}deg)`;
		}

		if (minuteHand) {
			minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
		}

		if (secondHand) {
			secondHand.style.transform = `rotate(${secondAngle}deg)`;
		}
	}

	function startHandsClock() {
		const handsWrapper = document.querySelector('.wc-pc13-hands');
		if (!handsWrapper) {
			if (handsTimer) {
				clearInterval(handsTimer);
				handsTimer = null;
			}
			return;
		}

		if (handsTimer) {
			clearInterval(handsTimer);
			handsTimer = null;
		}

		const tick = () => setHandsRotation(new Date());
		tick();
		handsTimer = window.setInterval(tick, 1000);
	}

	function bindDragging() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		function pointerDown(event, slotKey) {
			// Ne pas empêcher le comportement par défaut immédiatement
			// On le fera seulement si on détecte un drag
			const targetState = 'center' === slotKey ? state.center : state.slots[slotKey];
			if (!targetState) {
				return;
			}
			
			const pointerId = event.pointerId;
			const startX = event.clientX;
			const startY = event.clientY;
			const initialX = targetState.x;
			const initialY = targetState.y;
			let isClick = true;
			let hasMoved = false;

			// Obtenir la taille du conteneur pour calculer les pourcentages réels
			let containerSize = 100;
			if (slotKey === 'center') {
				const centerEl = configurator.querySelector(selectors.center);
				if (centerEl) {
					containerSize = centerEl.offsetWidth || state.center.size || 100;
				}
			} else {
				const slotEl = configurator.querySelector(`${selectors.slot}[data-slot="${slotKey}"]`);
				if (slotEl) {
					containerSize = slotEl.offsetWidth || state.ringSize || 100;
				}
			}

			const handleMove = (moveEvent) => {
				if (moveEvent.pointerId !== pointerId) {
					return;
				}
				const deltaX = moveEvent.clientX - startX;
				const deltaY = moveEvent.clientY - startY;
				if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
					isClick = false;
					hasMoved = true;
					// Empêcher le comportement par défaut seulement quand on drag
					moveEvent.preventDefault();
				}

				// Convertir les pixels en pourcentage réel par rapport à la taille du conteneur
				// 1 pixel de déplacement = (100 / containerSize) % de déplacement
				const percentPerPixel = 100 / containerSize;
				const deltaXPercent = deltaX * percentPerPixel;
				const deltaYPercent = deltaY * percentPerPixel;

				targetState.x = Math.max(-100, Math.min(100, initialX + deltaXPercent));
				targetState.y = Math.max(-100, Math.min(100, initialY + deltaYPercent));
				applyTransforms();
				savePayload();
				updateSelectionUI();
			};

			const handleUp = (upEvent) => {
				if (upEvent.pointerId !== pointerId) {
					return;
				}
				document.removeEventListener('pointermove', handleMove);
				document.removeEventListener('pointerup', handleUp);
				
				// Si c'était juste un clic (pas un drag), ne rien faire de plus
				// Le clic normal sera géré par bindSlotClicks
			};

			document.addEventListener('pointermove', handleMove);
			document.addEventListener('pointerup', handleUp);
		}

		configurator.querySelectorAll(`${selectors.slot} ${selectors.slotImage}`).forEach((imageEl) => {
			const slotKey = parseInt(imageEl.closest(selectors.slot).dataset.slot, 10);
			if (isNaN(slotKey)) {
				return;
			}

			// Gérer le pointerdown pour le drag
			imageEl.addEventListener('pointerdown', (event) => {
				// Sélectionner le slot d'abord
				selectSlot(slotKey);
				// Ensuite gérer le drag
				pointerDown(event, slotKey);
			});

			// Gérer le clic simple pour sélectionner
			imageEl.addEventListener('click', (event) => {
				event.stopPropagation();
				selectSlot(slotKey);
			});
		});

		const centerWrapper = configurator.querySelector(selectors.center);
		if (centerWrapper) {
			centerWrapper.addEventListener('click', (event) => {
				// Ne pas empêcher le comportement par défaut pour permettre la sélection
				selectSlot('center');
			});
		}

		const centerImage = configurator.querySelector(`${selectors.center} ${selectors.centerImage}`);
		if (centerImage) {
			// Gérer le pointerdown pour le drag
			centerImage.addEventListener('pointerdown', (event) => {
				// Sélectionner le centre d'abord
				selectSlot('center');
				// Ensuite gérer le drag
				pointerDown(event, 'center');
			});

			// Gérer le clic simple pour sélectionner
			centerImage.addEventListener('click', (event) => {
				event.stopPropagation();
				selectSlot('center');
			});
		}
	}

	function initDropzone() {
		const dropzoneEl = document.querySelector('.wc-pc13-dropzone');
		if (!dropzoneEl) {
			return;
		}

		const fileInput = document.querySelector(selectors.fileInput);
		const dropzoneContainer = document.querySelector('.wc-pc13-dropzone-container');

		if (!window.Dropzone) {
			const preventDefaults = (event) => {
				event.preventDefault();
				event.stopPropagation();
			};

			const toggleHighlight = (active) => {
				if (dropzoneEl) {
					dropzoneEl.classList.toggle('is-dragover', active);
				}
				if (dropzoneContainer) {
					dropzoneContainer.classList.toggle('is-dragover', active);
				}
			};

			const handleDragEnter = (event) => {
				preventDefaults(event);
				if (event.dataTransfer) {
					event.dataTransfer.dropEffect = 'copy';
				}
				toggleHighlight(true);
			};

			const handleDragLeave = (event) => {
				preventDefaults(event);
				const related = event.relatedTarget;
				if (related && (dropzoneEl?.contains(related) || dropzoneContainer?.contains(related))) {
					return;
				}
				toggleHighlight(false);
			};

			const handleDrop = (event) => {
				preventDefaults(event);
				toggleHighlight(false);
				const files = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : null;
				if (files && files.length) {
					processFile(files[0]);
				}
			};

			const fallbackElements = [dropzoneContainer, dropzoneEl].filter(Boolean);

			fallbackElements.forEach((element) => {
				element.addEventListener('click', (event) => {
					preventDefaults(event);
					if (fileInput) {
						fileInput.click();
					}
				});

				element.addEventListener('dragenter', handleDragEnter);
				element.addEventListener('dragover', handleDragEnter);
				element.addEventListener('dragleave', handleDragLeave);
				element.addEventListener('dragend', handleDragLeave);
				element.addEventListener('drop', handleDrop);
			});

			if (dropzoneEl) {
				dropzoneEl.addEventListener('submit', (event) => {
					event.preventDefault();
				});
			}

			['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
				document.addEventListener(eventName, preventDefaults);
			});

			return;
		}

		Dropzone.autoDiscover = false;

		if (dropzoneInstance && typeof dropzoneInstance.destroy === 'function') {
			dropzoneInstance.destroy();
		}

		dropzoneInstance = new Dropzone(dropzoneEl, {
			url: WCPC13.ajax_url,
			paramName: 'file',
			maxFiles: 1,
			acceptedFiles: 'image/*',
			uploadMultiple: false,
			addRemoveLinks: false,
			dictDefaultMessage: WCPC13.labels.dropzone_message,
			autoProcessQueue: true,
			params: {
				action: 'wc_pc13_upload_image',
				nonce: WCPC13.nonce,
			},
			createImageThumbnails: false,
		});

		dropzoneInstance.on('sending', (file, xhr, formData) => {
			const maxBytes = WCPC13.settings && WCPC13.settings.max_upload_bytes ? parseInt(WCPC13.settings.max_upload_bytes, 10) : 0;
			if (maxBytes && file.size > maxBytes) {
				if (xhr && xhr.abort) {
					xhr.abort();
				}
				dropzoneInstance.removeFile(file);
				window.alert(WCPC13.labels.file_too_large);
				return;
			}
			formData.append('slot', state.currentSlot);
		});

		dropzoneInstance.on('success', (file, responseText) => {
			let response = responseText;
			if (typeof responseText === 'string') {
				try {
					response = JSON.parse(responseText);
				} catch (error) {
					response = null;
				}
			}

			if (!response || !response.success) {
				const message = response && response.data && response.data.message ? response.data.message : WCPC13.labels.upload_error;
				window.alert(message);
				dropzoneInstance.removeFile(file);
				return;
			}

			applyUploadedImage(response.data);
			dropzoneInstance.removeFile(file);
		});

		dropzoneInstance.on('error', (file, errorMessage, xhr) => {
			let message = errorMessage;

			if (xhr && xhr.responseText) {
				try {
					const parsed = JSON.parse(xhr.responseText);
					if (parsed && parsed.data && parsed.data.message) {
						message = parsed.data.message;
					}
				} catch (error) {
					// Ignored, fallback to default handling below.
				}
			}

			if (errorMessage && typeof errorMessage === 'object') {
				message = errorMessage.message || errorMessage.error || WCPC13.labels.upload_error;
			}

			window.alert(message || WCPC13.labels.upload_error);
			dropzoneInstance.removeFile(file);
		});
	}

	function addPlaceholders() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		configurator.querySelectorAll(selectors.slotImage).forEach((imgEl) => {
			imgEl.classList.add('empty');
			imgEl.dataset.placeholder = WCPC13.labels.empty || 'Photo';
		});

		const centerImage = configurator.querySelector(selectors.centerImage);
		if (centerImage) {
			centerImage.classList.add('empty');
			centerImage.dataset.placeholder = WCPC13.labels.empty || 'Photo';
		}
	}

	function fillDemoImages() {
		if (!PLUGIN_URL) {
			console.warn('WCPC13 demo images: plugin URL not detected', { PLUGIN_URL });
			return;
		}

		// Vérifier que nous avons au moins une image
		if (!DEMO_IMAGES.center.image_url && (!DEMO_IMAGES.slots || DEMO_IMAGES.slots.length === 0)) {
			console.warn('WCPC13 demo images: no demo images available', { DEMO_IMAGES });
			return;
		}

		// Remplir l'image centrale
		const centerDemo = DEMO_IMAGES.center;
		if (centerDemo && centerDemo.image_url) {
			state.center.image_url = centerDemo.image_url;
			state.center.attachment_id = 0;
			state.center.scale = centerDemo.scale ?? 1;
			state.center.x = centerDemo.x ?? 0;
			state.center.y = centerDemo.y ?? 0;
			state.center.size = centerDemo.size ? Math.max(CENTER_MIN_SIZE, centerDemo.size) : state.center.size;
			if (window.WCPC13_DEBUG) {
				console.log('WCPC13 demo fill - center image applied', state.center);
			}
		}

		// S'assurer que tous les 12 slots sont initialisés et remplis
		let filledCount = 0;
		for (let i = 1; i <= 12; i++) {
			// Initialiser le slot s'il n'existe pas
			if (!state.slots[i]) {
				state.slots[i] = {
					attachment_id: 0,
					image_url: '',
					x: 0,
					y: 0,
					scale: 1,
				};
			}
			
			// Utiliser l'image de démonstration correspondante (index 0-11)
			const slotDemo = DEMO_IMAGES.slots && DEMO_IMAGES.slots[i - 1] ? DEMO_IMAGES.slots[i - 1] : null;
			if (slotDemo && slotDemo.image_url) {
				state.slots[i].attachment_id = 0;
				state.slots[i].image_url = slotDemo.image_url;
				state.slots[i].x = slotDemo.x ?? 0;
				state.slots[i].y = slotDemo.y ?? 0;
				state.slots[i].scale = slotDemo.scale ?? 1;
				filledCount++;
			} else if (centerDemo && centerDemo.image_url) {
				// Fallback: utiliser l'image centrale si pas d'image disponible pour ce slot
				state.slots[i].attachment_id = 0;
				state.slots[i].image_url = centerDemo.image_url;
				state.slots[i].x = 0;
				state.slots[i].y = 0;
				state.slots[i].scale = 1;
				filledCount++;
			}
			
			if (window.WCPC13_DEBUG) {
				console.log('WCPC13 demo fill - slot', i, state.slots[i]);
			}
		}

		if (window.WCPC13_DEBUG) {
			console.log('WCPC13 demo fill - filled', filledCount, 'slots out of 12');
		}

		state.currentSlot = 'center';
		applyTransforms();
		updateSelectionUI();
		savePayload();
		scheduleLivePreviewUpdate();
	}

	async function fillUnsplashImages() {
		const fillUnsplashBtn = document.querySelector(selectors.fillUnsplash);
		if (fillUnsplashBtn) {
			fillUnsplashBtn.disabled = true;
			fillUnsplashBtn.textContent = WCPC13?.labels?.loading_unsplash || 'Chargement...';
		}

		try {
			const formData = new FormData();
			formData.append('action', 'wc_pc13_fetch_unsplash');
			formData.append('nonce', WCPC13.nonce);
			formData.append('count', '13');

			const response = await fetch(WCPC13.ajax_url, {
				method: 'POST',
				credentials: 'same-origin',
				body: formData,
			});

			if (!response.ok) {
				throw new Error(WCPC13?.labels?.unsplash_error || 'Erreur lors de la récupération des images');
			}

			const data = await response.json();
			if (!data || !data.success || !data.data || !data.data.images || !Array.isArray(data.data.images)) {
				throw new Error(data?.data?.message || WCPC13?.labels?.unsplash_error || 'Aucune image récupérée');
			}

			const images = data.data.images;
			if (images.length === 0) {
				throw new Error(WCPC13?.labels?.unsplash_error || 'Aucune image disponible');
			}

			// Remplir l'image centrale (première image)
			if (images[0] && images[0].url) {
				state.center.image_url = images[0].url;
				state.center.attachment_id = 0;
				state.center.scale = 1;
				state.center.x = 0;
				state.center.y = 0;
				const configurator = document.querySelector(selectors.configurator);
				const centerSizeRange = configurator ? configurator.querySelector(selectors.centerSizeRange) : null;
				const centerMax = state.centerMax || (centerSizeRange ? parseInt(centerSizeRange.max || `${state.center.size}`, 10) : state.center.size);
				if (centerMax) {
					state.center.size = centerMax;
					if (centerSizeRange) {
						centerSizeRange.value = centerMax;
					}
				}
			}

			// Remplir les 12 slots périphériques
			for (let i = 1; i <= 12; i++) {
				const imageIndex = i < images.length ? i : (i % images.length);
				const image = images[imageIndex];
				
				if (!state.slots[i]) {
					state.slots[i] = {
						attachment_id: 0,
						image_url: '',
						x: 0,
						y: 0,
						scale: 1,
					};
				}
				
				if (image && image.url) {
					state.slots[i].attachment_id = 0;
					state.slots[i].image_url = image.url;
					state.slots[i].x = 0;
					state.slots[i].y = 0;
					state.slots[i].scale = 1;
				}
			}

			state.currentSlot = 'center';
			applyTransforms();
			updateSelectionUI();
			savePayload();
			scheduleLivePreviewUpdate();
		} catch (error) {
			console.error('Erreur lors du chargement des images Unsplash:', error);
			window.alert(error?.message || WCPC13?.labels?.unsplash_error || 'Erreur lors du chargement des images');
		} finally {
			if (fillUnsplashBtn) {
				fillUnsplashBtn.disabled = false;
				fillUnsplashBtn.textContent = WCPC13?.labels?.fill_unsplash || 'Charger des photos aléatoires Unsplash';
			}
		}
	}

	function init() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const preview = configurator.querySelector(selectors.preview);
		const ringSizeInput = configurator.querySelector(selectors.slotSizeRange);
		const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
		const numbersToggle = configurator.querySelector(selectors.numbersToggle);
		const numbersColor = configurator.querySelector(selectors.numbersColor);
		const numbersSize = configurator.querySelector(selectors.numbersSize);
		const numbersDistanceInput = configurator.querySelector(selectors.numbersDistance);
		if (centerSizeRange) {
			const initialCenterSize = parseInt(centerSizeRange.value || 180, 10);
			const sanitized = Number.isNaN(initialCenterSize) ? 180 : initialCenterSize;
			state.center.size = Math.max(CENTER_MIN_SIZE, sanitized);
			centerSizeRange.value = state.center.size;
		}

		if (numbersToggle) {
			state.showNumbers = !!numbersToggle.checked;
		}

		if (numbersColor && numbersColor.value) {
			state.numbers.color = numbersColor.value;
		}

		if (numbersSize) {
			const initialSize = parseInt(numbersSize.value || state.numbers.size, 10);
			if (!Number.isNaN(initialSize)) {
				state.numbers.size = Math.max(12, Math.min(96, initialSize));
			}
			numbersSize.value = state.numbers.size;
		}

		if (numbersDistanceInput) {
			const initialDistance = parseInt(numbersDistanceInput.value || state.numbers.distance, 10);
			if (!Number.isNaN(initialDistance)) {
				state.numbers.distance = Math.max(0, initialDistance);
			}
			numbersDistanceInput.value = state.numbers.distance;
		}

		if (preview && ringSizeInput) {
			const initial = parseInt(preview.dataset.initialSlotSize || ringSizeInput.value || 80, 10);
			state.ringSize = initial;
			ringSizeInput.value = initial;
		}

			updateRingDimensions();

		initSlots();
		addPlaceholders();
		bindSlotClicks();
		bindControls();
		bindHandsControls();
		bindDragging();
		initDropzone();
		selectSlot('center');
		applyTransforms();
		updateSelectionUI();
		savePayload();
		startHandsClock();
		initCustomAddToCart();
		scheduleLivePreviewUpdate();

		window.addEventListener('resize', () => {
			applyTransforms();
			savePayload();
		});
	}

	function showAddToCartNotification(data) {
		// Créer la notification
		const notification = document.createElement('div');
		notification.className = 'wc-pc13-cart-notification';
		notification.innerHTML = `
			<div class="wc-pc13-notification-content">
				${data.preview_url ? `<img src="${data.preview_url}" alt="Horloge" class="wc-pc13-notification-image">` : ''}
				<div class="wc-pc13-notification-text">
					<strong>${data.message || 'Produit ajouté au panier'}</strong>
					${data.product_name ? `<p>${data.product_name}</p>` : ''}
					${data.cart_count ? `<p class="wc-pc13-cart-count">${data.cart_count} article${data.cart_count > 1 ? 's' : ''} dans le panier</p>` : ''}
				</div>
				<button class="wc-pc13-notification-close" aria-label="Fermer">&times;</button>
			</div>
		`;

		document.body.appendChild(notification);

		// Animation d'entrée
		setTimeout(() => {
			notification.classList.add('show');
		}, 10);

		// Fermer au clic sur le bouton
		const closeBtn = notification.querySelector('.wc-pc13-notification-close');
		if (closeBtn) {
			closeBtn.addEventListener('click', () => {
				notification.classList.remove('show');
				setTimeout(() => {
					if (notification.parentNode) {
						notification.parentNode.removeChild(notification);
					}
				}, 300);
			});
		}

		// Fermer automatiquement après 5 secondes
		setTimeout(() => {
			if (notification.parentNode) {
				notification.classList.remove('show');
				setTimeout(() => {
					if (notification.parentNode) {
						notification.parentNode.removeChild(notification);
					}
				}, 300);
			}
		}, 5000);
	}

	$(init);
})(jQuery);

