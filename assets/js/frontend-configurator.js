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

	const MAX_SCALE = 5;
	const MIN_SCALE = 1;

	const state = {
		currentSlot: 'center',
		color: '#111111',
		secondHand: 'black', // 'red', 'black', ou 'none'
		diameter: 40, // Diamètre par défaut en cm
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
		slotBorder: {
			enabled: false,
			color: '#000000',
			width: 2,
		},
		slotShadow: {
			enabled: false,
		},
		showSlots: true,
	};

	function clampTransformValues(target) {
		const transform = target || {};
		const rawScale = Number.isFinite(transform.scale) ? transform.scale : MIN_SCALE;
		const safeScale = Math.min(Math.max(rawScale, MIN_SCALE), MAX_SCALE);
		transform.scale = safeScale;

		if (safeScale <= 1) {
			transform.x = 0;
			transform.y = 0;
			return { x: 0, y: 0, scale: safeScale, maxOffset: 0 };
		}

		const maxOffset = (safeScale - 1) * 50;
		const rawX = Number.isFinite(transform.x) ? transform.x : 0;
		const rawY = Number.isFinite(transform.y) ? transform.y : 0;
		const x = Math.max(-maxOffset, Math.min(maxOffset, rawX));
		const y = Math.max(-maxOffset, Math.min(maxOffset, rawY));
		const clampedX = Math.max(-maxOffset, Math.min(maxOffset, x));
		const clampedY = Math.max(-maxOffset, Math.min(maxOffset, y));
		transform.x = clampedX;
		transform.y = clampedY;
		return { x: clampedX, y: clampedY, scale: safeScale, maxOffset };
	}

let dropzoneInstance = null;
let handsTimer = null;
let html2canvasLoader = null;
let jsPDFLoader = null;
let uploadTargetSlot = null;
let shareLoading = false;
let sharedConfigLoaded = false;

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
									
									// S'assurer que l'image centrale est visible et correctement positionnée
									clonedCenterEl.style.transform = 'none';
									clonedCenterEl.style.left = `${offsetLeft * scale}px`;
									clonedCenterEl.style.top = `${offsetTop * scale}px`;
									clonedCenterEl.style.width = `${width * scale}px`;
									clonedCenterEl.style.height = `${height * scale}px`;
									clonedCenterEl.style.margin = '0';
									clonedCenterEl.style.inset = 'auto';
									clonedCenterEl.style.position = 'absolute';
									clonedCenterEl.style.zIndex = '2';
									clonedCenterEl.style.display = 'block';
									clonedCenterEl.style.visibility = 'visible';
									clonedCenterEl.style.opacity = '1';
									
									// S'assurer que le background-image est bien copié
									if (centerEl && state.center.image_url) {
										const originalBg = centerComputedStyles.backgroundImage;
										if (originalBg && originalBg !== 'none') {
											clonedCenterEl.style.backgroundImage = originalBg;
										} else {
											// Fallback : utiliser l'URL directement
											clonedCenterEl.style.backgroundImage = `url("${state.center.image_url}")`;
										}
									}
									
									if (centerBackgroundSize) {
										clonedCenterEl.style.backgroundSize = centerBackgroundSize;
									} else {
										clonedCenterEl.style.backgroundSize = 'cover';
									}
									
									if (centerBackgroundPosition) {
										clonedCenterEl.style.backgroundPosition = centerBackgroundPosition;
									} else {
										clonedCenterEl.style.backgroundPosition = 'center';
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
										clonedCenterWrapper.style.zIndex = '1';
										clonedCenterWrapper.style.display = 'block';
										clonedCenterWrapper.style.visibility = 'visible';
									}
									
									// S'assurer que les aiguilles sont au-dessus mais n'obscurcissent pas l'image
									const clonedHands = clonedDoc.querySelector('.wc-pc13-hands');
									if (clonedHands) {
										clonedHands.style.zIndex = '5';
									}
									
									if (window.WCPC13_DEBUG) {
										const cloneRect = clonedCenterEl.getBoundingClientRect();
										console.groupCollapsed('🪞 DEBUG capturePreview - Clone html2canvas');
										console.log('applied transform', clonedCenterEl.style.transform);
										console.log('transformOrigin', clonedCenterEl.style.transformOrigin);
										console.log('backgroundSize', clonedCenterEl.style.backgroundSize);
										console.log('backgroundPosition', clonedCenterEl.style.backgroundPosition);
										console.log('backgroundImage', clonedCenterEl.style.backgroundImage);
										console.log('zIndex', clonedCenterEl.style.zIndex);
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

		// Capturer l'image avec une résolution réduite pour le panier (plus rapide)
		// Utiliser printMode: false pour inclure les aiguilles (même logique que downloadAsJpeg)
		try {
			// Utiliser scale 1 et qualité réduite pour un upload plus rapide
			const canvas = await capturePreview(1, { printMode: false, skipLivePreviewUpdate: true });
			const blob = await canvasToJpegBlob(canvas, 0.75);

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
		return Math.max((baseSize / 2) - (size / 2) - 35, 50);
	}

	function drawCircularImage(ctx, centerX, centerY, diameter, image, transformState, options = {}) {
		if (!image) {
			return;
		}

		const radius = diameter / 2;
		const scaleFactor = options.scaleFactor || 1;
		
		// Dessiner l'ombre portée si activée
		if (options.shadowEnabled) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(centerX + 4 * scaleFactor, centerY + 4 * scaleFactor, radius, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
			ctx.fill();
			ctx.restore();
		}
		
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
		
		// Dessiner la bordure si activée
		if (options.borderEnabled && options.borderWidth && options.borderColor) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
			ctx.lineWidth = options.borderWidth * scaleFactor;
			ctx.strokeStyle = options.borderColor;
			ctx.stroke();
			ctx.restore();
		}
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
			if (!index || index < 1 || index > 12) {
				return;
			}
			const imageEl = slotEl.querySelector(selectors.slotImage);
			if (!imageEl) {
				return;
			}
			const styles = window.getComputedStyle(imageEl);
			const backgroundImage = styles.backgroundImage || '';
			let imageUrl = '';
			// Améliorer l'extraction de l'URL depuis backgroundImage
			if (backgroundImage && backgroundImage !== 'none') {
				// Essayer plusieurs patterns pour extraire l'URL
				const patterns = [
					/url\(["']?([^"']+)["']?\)/,  // url("...") ou url('...') ou url(...)
					/url\(([^)]+)\)/,            // url(...) sans guillemets
				];
				for (const pattern of patterns) {
					const match = backgroundImage.match(pattern);
					if (match && match[1]) {
						imageUrl = match[1].trim();
						break;
					}
				}
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
			// Prioriser l'URL du DOM si elle existe, sinon utiliser celle du state
			const resolvedUrl = (domInfo.imageUrl && domInfo.imageUrl.trim()) || (state.slots[i].image_url && state.slots[i].image_url.trim()) || '';
			const resolvedTransform = {
				x: Number.isFinite(domInfo.x) ? domInfo.x : (Number.isFinite(state.slots[i].x) ? state.slots[i].x : 0),
				y: Number.isFinite(domInfo.y) ? domInfo.y : (Number.isFinite(state.slots[i].y) ? state.slots[i].y : 0),
				scale: Number.isFinite(domInfo.scale) && domInfo.scale > 0 ? domInfo.scale : (Number.isFinite(state.slots[i].scale) && state.slots[i].scale > 0 ? state.slots[i].scale : MIN_SCALE),
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

		// Charger toutes les images avec gestion d'erreur pour chaque image
		const slotImages = await Promise.all(
			slotEntries.map(async (entry) => {
				if (!entry.imageUrl || !entry.imageUrl.trim()) {
					if (window.WCPC13_DEBUG) {
						console.warn(`[PDF] Slot ${entry.index}: pas d'URL d'image`);
					}
					return null;
				}
				try {
					const img = await loadImageAsset(entry.imageUrl);
					if (!img) {
						if (window.WCPC13_DEBUG) {
							console.warn(`[PDF] Slot ${entry.index}: échec du chargement de l'image`, entry.imageUrl);
						}
					} else if (window.WCPC13_DEBUG) {
						console.log(`[PDF] Slot ${entry.index}: image chargée`, entry.imageUrl);
					}
					return img;
				} catch (error) {
					if (window.WCPC13_DEBUG) {
						console.error(`[PDF] Slot ${entry.index}: erreur lors du chargement`, error, entry.imageUrl);
					}
					return null;
				}
			})
		);

		let centerImageUrl = state.center?.image_url || '';
		let centerTransformFallback = { ...state.center };
		const centerImageEl = configurator.querySelector(selectors.centerImage);
		if (!centerImageUrl && centerImageEl) {
			const styles = window.getComputedStyle(centerImageEl);
			const bg = styles.backgroundImage || '';
			// Améliorer l'extraction de l'URL depuis backgroundImage
			if (bg && bg !== 'none') {
				const patterns = [
					/url\(["']?([^"']+)["']?\)/,  // url("...") ou url('...') ou url(...)
					/url\(([^)]+)\)/,            // url(...) sans guillemets
				];
				for (const pattern of patterns) {
					const match = bg.match(pattern);
					if (match && match[1]) {
						centerImageUrl = match[1].trim();
						break;
					}
				}
			}
		}
		// Prioriser l'URL du DOM si elle existe
		if (centerImageEl && !centerImageUrl) {
			const styles = window.getComputedStyle(centerImageEl);
			const bg = styles.backgroundImage || '';
			if (bg && bg !== 'none') {
				const patterns = [
					/url\(["']?([^"']+)["']?\)/,
					/url\(([^)]+)\)/,
				];
				for (const pattern of patterns) {
					const match = bg.match(pattern);
					if (match && match[1]) {
						centerImageUrl = match[1].trim();
						break;
					}
				}
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

		let drawnSlotsCount = 0;
		slotEntries.forEach((entry, idx) => {
			const image = slotImages[idx];
			if (!image) {
				if (window.WCPC13_DEBUG) {
					console.warn(`[PDF] Slot ${entry.index}: image non disponible, ignorée`);
				}
				return;
			}
			const angleDeg = (entry.index % 12) * 30;
			const angleRad = (angleDeg * Math.PI) / 180;
			const slotCenterX = centerX + Math.sin(angleRad) * ringRadius;
			const slotCenterY = centerY - Math.cos(angleRad) * ringRadius;

			const clampedState = clampTransformValues(entry.state);
			drawCircularImage(ctx, slotCenterX, slotCenterY, slotSize, image, clampedState, {
				scaleFactor: scaleFactor,
				borderEnabled: state.slotBorder?.enabled || false,
				borderWidth: state.slotBorder?.width || 2,
				borderColor: state.slotBorder?.color || '#000000',
				shadowEnabled: state.slotShadow?.enabled || false,
			});
			drawnSlotsCount++;
			if (window.WCPC13_DEBUG) {
				console.log(`[PDF] Slot ${entry.index}: image dessinée à (${slotCenterX.toFixed(1)}, ${slotCenterY.toFixed(1)})`);
			}
		});
		
		if (window.WCPC13_DEBUG) {
			console.log(`[PDF] ${drawnSlotsCount} photos périphériques dessinées sur ${slotEntries.length}`);
		}

		if (centerImage) {
			const clampedCenter = clampTransformValues(centerTransformFallback);
			drawCircularImage(ctx, centerX, centerY, centerSize, centerImage, clampedCenter, {
				scaleFactor: scaleFactor,
				shadowEnabled: state.slotShadow?.enabled || false,
				borderEnabled: state.slotBorder?.enabled || false,
				borderWidth: state.slotBorder?.width || 2,
				borderColor: state.slotBorder?.color || '#000000',
			});
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
		shareBtn: '.wc-pc13-share-btn',
		shareModal: '.wc-pc13-share-modal',
		shareModalClose: '.wc-pc13-share-modal-close',
		shareUrlInput: '#wc-pc13-share-url',
		copyLinkBtn: '.wc-pc13-copy-link-btn',
		shareEmail: '.wc-pc13-share-email',
		shareWhatsapp: '.wc-pc13-share-whatsapp',
		shareFacebook: '.wc-pc13-share-facebook',
		shareX: '.wc-pc13-share-x',
		saveEmailBtn: '.wc-pc13-save-email-btn',
		showSlotsToggle: '#wc-pc13-show-slots',
		livePreviewImage: '.wc-pc13-live-preview-image',
		livePreviewPlaceholder: '.wc-pc13-live-preview-placeholder',
		fillUnsplash: '.wc-pc13-fill-unsplash',
		slotBorderEnabled: '#wc-pc13-slot-border-enabled',
		slotBorderColor: '#wc-pc13-slot-border-color',
		slotBorderWidth: '#wc-pc13-slot-border-width',
		slotBorderFields: '.wc-pc13-slot-border-fields',
		slotShadowEnabled: '#wc-pc13-slot-shadow-enabled',
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
		const radius = Math.max((previewWidth / 2) - (size / 2) - 35, 50);

		preview.style.setProperty('--slot-size', `${size}px`);
		preview.style.setProperty('--ring-radius', `${radius}px`);
		preview.classList.toggle('hide-slots', !state.showSlots);

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

			if (slotState.image_url && state.showSlots) {
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

			const { x, y, scale } = clampTransformValues(slotState);
			slot.style.transform = 'none';
			slot.style.backgroundSize = `${scale * 100}%`;
			slot.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
			slot.dataset.axisX = x;
			slot.dataset.axisY = y;
			slot.dataset.zoom = scale;
			
			// Appliquer les styles de bordure et d'ombre (seulement si le slot n'est pas actif)
			const slotElement = slot.closest(selectors.slot);
			const isActive = slotElement && slotElement.classList.contains('active');
			
			if (!isActive) {
				if (state.slotBorder.enabled) {
					slot.style.border = `${state.slotBorder.width}px solid ${state.slotBorder.color}`;
				} else {
					slot.style.border = '';
				}
				
				if (state.slotShadow.enabled) {
					slot.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
				} else {
					slot.style.boxShadow = '';
				}
			} else {
				// Réinitialiser les styles quand le slot est actif (le CSS gère le style actif)
				slot.style.border = '';
				slot.style.boxShadow = '';
			}
			
			if (slotInner) {
				slotInner.dataset.axisX = x;
				slotInner.dataset.axisY = y;
				slotInner.dataset.zoom = scale;
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

				const { x, y, scale } = clampTransformValues(state.center);
				centerEl.style.transform = 'none';
				centerEl.style.backgroundSize = `${scale * 100}%`;
				centerEl.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
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

		// Afficher/masquer le bloc éditeur uniquement pour les slots périphériques (pas le centre)
		const slotEditor = configurator.querySelector('.wc-pc13-slot-editor');
		if (slotEditor) {
			// Masquer le panneau latéral pour les photos périphériques
			if (state.currentSlot && state.currentSlot !== 'center' && parseInt(state.currentSlot, 10) >= 1 && parseInt(state.currentSlot, 10) <= 12) {
				slotEditor.classList.remove('has-selection');
			} else {
				slotEditor.classList.remove('has-selection');
			}
		}

		// Afficher/masquer le panneau flottant pour les photos périphériques
		const floatingControls = configurator.querySelector('.wc-pc13-floating-controls');
		if (floatingControls) {
			if (state.currentSlot && state.currentSlot !== 'center' && parseInt(state.currentSlot, 10) >= 1 && parseInt(state.currentSlot, 10) <= 12) {
				// Afficher le panneau flottant et le positionner
				floatingControls.style.display = 'block';
				positionFloatingControls(state.currentSlot);
				
				// Mettre à jour les contrôles du panneau flottant
				const floatingZoom = floatingControls.querySelector('input[data-zoom]');
				const floatingAxisX = floatingControls.querySelector('input[data-axis="x"]');
				const floatingAxisY = floatingControls.querySelector('input[data-axis="y"]');
				const floatingRemove = floatingControls.querySelector('.wc-pc13-floating-remove');
				
				if (floatingZoom) {
					floatingZoom.value = current.scale;
				}
				if (floatingAxisX) {
					floatingAxisX.value = current.x;
				}
				if (floatingAxisY) {
					floatingAxisY.value = current.y;
				}
				if (floatingRemove) {
					floatingRemove.disabled = !current.image_url;
				}
				const floatingUpload = floatingControls.querySelector('.wc-pc13-floating-upload');
				if (floatingUpload) {
					floatingUpload.disabled = false;
				}
			} else {
				// Masquer le panneau flottant
				floatingControls.style.display = 'none';
			}
		}

		if (centerPanel) {
			centerPanel.classList.add('is-active');
		}
	}

	function savePayload() {
		const payloadInput = document.querySelector(selectors.payload);
		
		const payload = {
			color: state.color,
			second_hand: state.secondHand,
			diameter: state.diameter,
			slots: state.slots,
			center: state.center,
			ring_size: state.ringSize,
			show_slots: state.showSlots,
			show_numbers: state.showNumbers,
			numbers: state.numbers,
			slot_border: state.slotBorder,
			slot_shadow: state.slotShadow,
		};

		if (payloadInput) {
			payloadInput.value = JSON.stringify(payload);
		}
		
		return payload;
	}

	function selectSlot(slot) {
		// Si les slots sont masqués, forcer le centre
		if (!state.showSlots && slot !== 'center') {
			state.currentSlot = 'center';
		} else {
			state.currentSlot = slot;
		}
		updateSelectionUI();
	}

	function closeFloatingControls() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const floatingControls = configurator.querySelector('.wc-pc13-floating-controls');
		if (floatingControls) {
			floatingControls.style.display = 'none';
		}

		// Désélectionner le slot périphérique
		if (state.currentSlot && state.currentSlot !== 'center' && parseInt(state.currentSlot, 10) >= 1 && parseInt(state.currentSlot, 10) <= 12) {
			selectSlot('center');
		}
	}

	function positionFloatingControls(slotKey) {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

	if (!state.showSlots) {
		return;
	}

		const floatingControls = configurator.querySelector('.wc-pc13-floating-controls');
		const preview = configurator.querySelector('.wc-pc13-preview');
		
		if (!floatingControls || !preview) {
			return;
		}

		// Obtenir la position du preview
		const previewRect = preview.getBoundingClientRect();
		
		// Centrer le panneau au centre de l'horloge (au niveau des aiguilles)
		const centerX = previewRect.width / 2;
		const centerY = previewRect.height / 2;
		
		floatingControls.style.left = `${centerX}px`;
		floatingControls.style.top = `${centerY}px`;
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

function applyUploadedImage(data, targetSlot = null) {
		if (!data) {
			return;
		}

	const slotKey = targetSlot || state.currentSlot || 'center';
	const target = slotKey === 'center' ? state.center : state.slots[slotKey] || state.center;
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

	const slotKey = uploadTargetSlot
		|| (inputEl && inputEl.dataset && inputEl.dataset.targetSlot)
		|| state.currentSlot;
	const configurator = document.querySelector(selectors.configurator);
	// Nettoyer le targetSlot pour les prochains uploads
	if (inputEl && inputEl.dataset) {
		delete inputEl.dataset.targetSlot;
	}
	uploadTargetSlot = null;

	const slotElement = configurator
		? (slotKey === 'center'
			? configurator.querySelector(selectors.center)
			: configurator.querySelector(`${selectors.slot}[data-slot="${slotKey}"]`))
		: null;
	if (slotElement) {
		slotElement.classList.add('wc-pc13-slot-loading');
	}
	
	// Afficher le loader
	let loadingButton = null;
	let originalText = '';
	if (slotKey === 'center') {
		loadingButton = configurator ? configurator.querySelector(selectors.centerSelectButton) : null;
		if (loadingButton) {
			originalText = loadingButton.textContent.trim();
		}
	} else {
		// Pour les slots périphériques, trouver le bouton d'upload
		loadingButton = configurator ? configurator.querySelector('.wc-pc13-upload-button') : null;
		if (loadingButton) {
			originalText = loadingButton.textContent.trim();
		}
	}
	
	if (loadingButton && originalText) {
		loadingButton.disabled = true;
		loadingButton.classList.add('wc-pc13-loading');
		loadingButton.innerHTML = '<span class="wc-pc13-spinner"></span> ' + originalText;
	}

	uploadFile(slotKey, file)
		.then((response) => {
			applyUploadedImage(response, slotKey);
		})
		.catch((error) => {
			window.alert(error);
		})
		.finally(() => {
			if (slotElement) {
				slotElement.classList.remove('wc-pc13-slot-loading');
			}
			// Masquer le loader
			if (loadingButton && originalText) {
				loadingButton.disabled = false;
				loadingButton.classList.remove('wc-pc13-loading');
				loadingButton.textContent = originalText;
			}
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
		clampTransformValues(current);
		applyTransforms();
		savePayload();
	}

	function handleAxisChange(event) {
		const axis = event.target.dataset.axis;
		const current = getCurrentSlotState();
		if ('x' === axis) {
			current.x = -parseFloat(event.target.value);
		} else if ('y' === axis) {
			current.y = -parseFloat(event.target.value);
		}
		clampTransformValues(current);
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
}

function handleSlotBorderEnabledChange(event) {
	state.slotBorder.enabled = !!event.target.checked;
	const configurator = document.querySelector(selectors.configurator);
	if (configurator) {
		const slotBorderFields = configurator.querySelector(selectors.slotBorderFields);
		if (slotBorderFields) {
			slotBorderFields.style.display = state.slotBorder.enabled ? 'block' : 'none';
		}
	}
	applyTransforms();
	savePayload();
}

function handleSlotBorderColorChange(event) {
	state.slotBorder.color = event.target.value || '#000000';
	applyTransforms();
	savePayload();
}

function handleSlotBorderWidthChange(event) {
	const value = parseInt(event.target.value, 10);
	if (Number.isNaN(value)) {
		return;
	}
	state.slotBorder.width = Math.max(1, Math.min(10, value));
	applyTransforms();
	savePayload();
}

function handleSlotShadowEnabledChange(event) {
	state.slotShadow.enabled = !!event.target.checked;
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
				
				// Générer la vignette et uploader l'aperçu en parallèle
				const [previewData, thumbnailDataUrl] = await Promise.all([
					uploadPreviewForCart(),
					generateThumbnail(1, 0.75)
				]);

				// Uploader le PDF en arrière-plan (non bloquant)
				uploadPdfForCart().catch((error) => {
					console.warn('Erreur lors de l\'upload du PDF (non bloquant):', error);
				});

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
		const shareBtn = configurator.querySelector(selectors.shareBtn);
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

		// Event listeners pour le panneau flottant
		const floatingControls = configurator.querySelector('.wc-pc13-floating-controls');
		if (floatingControls) {
			const floatingZoom = floatingControls.querySelector('input[data-zoom]');
			const floatingAxisX = floatingControls.querySelector('input[data-axis="x"]');
			const floatingAxisY = floatingControls.querySelector('input[data-axis="y"]');
			const floatingRemove = floatingControls.querySelector('.wc-pc13-floating-remove');
			const floatingClose = floatingControls.querySelector('.wc-pc13-floating-controls-close');
			const floatingUpload = floatingControls.querySelector('.wc-pc13-floating-upload');
			const fileInput = configurator.querySelector(selectors.fileInput);

			if (floatingZoom) {
				floatingZoom.addEventListener('input', handleZoomChange);
			}

			if (floatingAxisX) {
				floatingAxisX.addEventListener('input', handleAxisChange);
			}

			if (floatingAxisY) {
				floatingAxisY.addEventListener('input', handleAxisChange);
			}

			if (floatingRemove) {
				floatingRemove.addEventListener('click', handleRemove);
			}

			if (floatingUpload && fileInput) {
				floatingUpload.addEventListener('click', (e) => {
					e.preventDefault();
					// S'assurer que le slot courant reste sélectionné
					if (state.currentSlot && state.currentSlot !== 'center') {
						selectSlot(state.currentSlot);
					}
					// Forcer l'upload sur le slot sélectionné (périphérique)
					uploadTargetSlot = state.currentSlot;
					fileInput.dataset.targetSlot = state.currentSlot;
					fileInput.click();
				});
			}

			// Bouton de fermeture
			if (floatingClose) {
				floatingClose.addEventListener('click', (e) => {
					e.stopPropagation();
					closeFloatingControls();
				});
			}
		}

		// Détecter les clics hors sélection périphérique pour fermer le panneau flottant
		const preview = configurator.querySelector('.wc-pc13-preview');
		const ring = configurator.querySelector('.wc-pc13-ring');
		if (preview && ring) {
			document.addEventListener('click', (e) => {
				// Ne pas fermer si on clique sur le panneau flottant ou ses éléments
				const floatingControlsEl = configurator.querySelector('.wc-pc13-floating-controls');
				if (floatingControlsEl && floatingControlsEl.contains(e.target)) {
					return;
				}

				// Si une photo périphérique est sélectionnée, fermer si on clique ailleurs que sur cette photo
				if (!state.showSlots) {
					return;
				}
				const isPeripheralSelection = state.currentSlot && state.currentSlot !== 'center' && parseInt(state.currentSlot, 10) >= 1 && parseInt(state.currentSlot, 10) <= 12;
				if (!isPeripheralSelection) {
					return;
				}

				const selectedSlotEl = configurator.querySelector(`${selectors.slot}[data-slot="${state.currentSlot}"]`);
				const clickedInsideSelectedSlot = selectedSlotEl && selectedSlotEl.contains(e.target);

				// Fermer si on clique en dehors du slot sélectionné, ou en dehors de l'horloge
				if (!clickedInsideSelectedSlot || !ring.contains(e.target)) {
					closeFloatingControls();
				}
			});
		}

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

	const slotBorderEnabled = configurator.querySelector(selectors.slotBorderEnabled);
	const slotBorderColor = configurator.querySelector(selectors.slotBorderColor);
	const slotBorderWidth = configurator.querySelector(selectors.slotBorderWidth);
	const slotBorderFields = configurator.querySelector(selectors.slotBorderFields);
	const slotShadowEnabled = configurator.querySelector(selectors.slotShadowEnabled);

	if (slotBorderEnabled) {
		slotBorderEnabled.checked = !!state.slotBorder.enabled;
		slotBorderEnabled.addEventListener('change', handleSlotBorderEnabledChange);
		if (slotBorderFields) {
			slotBorderFields.style.display = state.slotBorder.enabled ? 'block' : 'none';
		}
	}

	if (slotBorderColor) {
		slotBorderColor.value = state.slotBorder.color;
		slotBorderColor.addEventListener('change', handleSlotBorderColorChange);
	}

	if (slotBorderWidth) {
		slotBorderWidth.value = state.slotBorder.width;
		slotBorderWidth.addEventListener('input', handleSlotBorderWidthChange);
	}

	if (slotShadowEnabled) {
		slotShadowEnabled.checked = !!state.slotShadow.enabled;
		slotShadowEnabled.addEventListener('change', handleSlotShadowEnabledChange);
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
			// Forcer l'upload sur le slot sélectionné (centre ou périphérique)
			uploadTargetSlot = state.currentSlot || 'center';
			if (fileInput && fileInput.dataset) {
				fileInput.dataset.targetSlot = uploadTargetSlot;
			}
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

		if (shareBtn) {
			shareBtn.addEventListener('click', (event) => {
				event.preventDefault();
			if (shareLoading) {
				return;
			}
			openShareModal(shareBtn);
			});
		}

	const saveEmailBtn = configurator.querySelector(selectors.saveEmailBtn);
	if (saveEmailBtn) {
		saveEmailBtn.addEventListener('click', async (event) => {
			event.preventDefault();
			if (shareLoading) {
				return;
			}
			const email = window.prompt(WCPC13.labels?.enter_email || 'Entrez votre email pour recevoir le lien :');
			if (!email || !email.trim()) {
				return;
			}
			await saveShareAndSendEmail(email.trim(), saveEmailBtn);
		});
	}

	const showSlotsToggle = configurator.querySelector(selectors.showSlotsToggle);
	if (showSlotsToggle) {
		showSlotsToggle.checked = !!state.showSlots;
		showSlotsToggle.addEventListener('change', (e) => {
			state.showSlots = !!e.target.checked;
			// Si on masque les slots, forcer la sélection sur le centre
			if (!state.showSlots) {
				selectSlot('center');
			}
			applyTransforms();
			updateSelectionUI();
			savePayload();
		});
	}

		// Gestion du modal de partage
		const shareModal = configurator.querySelector(selectors.shareModal);
		const shareModalClose = configurator.querySelector(selectors.shareModalClose);
		if (shareModalClose) {
			shareModalClose.addEventListener('click', () => {
				closeShareModal();
			});
		}
		if (shareModal) {
			shareModal.addEventListener('click', (event) => {
				if (event.target === shareModal) {
					closeShareModal();
				}
			});
		}

		// Bouton copier le lien
		const copyLinkBtn = configurator.querySelector(selectors.copyLinkBtn);
		if (copyLinkBtn) {
			copyLinkBtn.addEventListener('click', () => {
				copyShareLink();
			});
		}

		// Boutons de partage social
		const shareEmailBtn = configurator.querySelector(selectors.shareEmail);
		const shareWhatsappBtn = configurator.querySelector(selectors.shareWhatsapp);
		const shareFacebookBtn = configurator.querySelector(selectors.shareFacebook);
		const shareXBtn = configurator.querySelector(selectors.shareX);

		if (shareEmailBtn) {
			shareEmailBtn.addEventListener('click', (event) => {
				event.preventDefault();
				shareViaEmail();
			});
		}
		if (shareWhatsappBtn) {
			shareWhatsappBtn.addEventListener('click', (event) => {
				event.preventDefault();
				shareViaWhatsapp();
			});
		}
		if (shareFacebookBtn) {
			shareFacebookBtn.addEventListener('click', (event) => {
				event.preventDefault();
				shareViaFacebook();
			});
		}
		if (shareXBtn) {
			shareXBtn.addEventListener('click', (event) => {
				event.preventDefault();
				shareViaX();
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

		// Gérer le changement de diamètre
		const diameterInput = document.querySelector('#wc-pc13-diameter');
		if (diameterInput) {
			// Initialiser le diamètre depuis la valeur sélectionnée
			state.diameter = parseInt(diameterInput.value, 10) || 40;
			
			diameterInput.addEventListener('change', (event) => {
				state.diameter = parseInt(event.target.value, 10) || 40;
				savePayload();
			});
		}

		// Gérer le changement de la trotteuse
		const secondHandInput = document.querySelector('#wc-pc13-second-hand');
		if (secondHandInput) {
			// Initialiser la trotteuse depuis la valeur sélectionnée
			state.secondHand = secondHandInput.value || 'black';
			updateSecondHand();
			
			secondHandInput.addEventListener('change', (event) => {
				state.secondHand = event.target.value || 'black';
				updateSecondHand();
				savePayload();
			});
		}
	}

	function updateHandsColor() {
		const color = (state.color || '#111111').toLowerCase();
		const hands = document.querySelectorAll('.wc-pc13-hand.hour, .wc-pc13-hand.minute');
		const needsOutline = '#ffffff' === color;

		hands.forEach((hand) => {
			hand.style.background = color;
			hand.style.boxShadow = needsOutline ? '0 0 0 1px rgba(0, 0, 0, 0.2)' : 'none';
		});
		
		updateSecondHand();
	}

	function updateSecondHand() {
		const secondHand = document.querySelector('.wc-pc13-hand.second');
		if (!secondHand) {
			return;
		}

		if (state.secondHand === 'none') {
			secondHand.style.display = 'none';
		} else {
			secondHand.style.display = '';
			const color = state.secondHand === 'red' ? '#cc1f1a' : '#111111';
			secondHand.style.background = color;
			secondHand.style.boxShadow = 'none';
		}
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
		const milliseconds = date.getMilliseconds();

		const hourAngle = (hours * 30) + (minutes * 0.5);
		const minuteAngle = (minutes * 6) + (seconds * 0.1);
		// Rotation fluide de la trotteuse avec les millisecondes
		const secondAngle = (seconds * 6) + (milliseconds * 0.006);

		if (hourHand) {
			hourHand.style.transform = `rotate(${hourAngle}deg)`;
		}

		if (minuteHand) {
			minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
		}

		if (secondHand && state.secondHand !== 'none') {
			secondHand.style.transform = `rotate(${secondAngle}deg)`;
		}
	}

	function startHandsClock() {
		const handsWrapper = document.querySelector('.wc-pc13-hands');
		if (!handsWrapper) {
			if (handsTimer) {
				cancelAnimationFrame(handsTimer);
				handsTimer = null;
			}
			return;
		}

		if (handsTimer) {
			cancelAnimationFrame(handsTimer);
			handsTimer = null;
		}

		// Animation fluide avec requestAnimationFrame pour la trotteuse
		let lastTime = performance.now();
		const animate = (currentTime) => {
			if (handsTimer) {
				// Mettre à jour toutes les 50ms pour une animation fluide
				if (currentTime - lastTime >= 50) {
					setHandsRotation(new Date());
					lastTime = currentTime;
				}
				handsTimer = requestAnimationFrame(animate);
			}
		};
		
		setHandsRotation(new Date());
		handsTimer = requestAnimationFrame(animate);
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
				// Déplacement adouci et inversé pour une sensation plus fluide
				const percentPerPixel = (100 / containerSize) * 0.65;
				const deltaXPercent = -deltaX * percentPerPixel;
				const deltaYPercent = -deltaY * percentPerPixel;

				targetState.x = initialX + deltaXPercent;
				targetState.y = initialY + deltaYPercent;
				clampTransformValues(targetState);
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
					// Définir la taille à 45% de la taille maximale pour la démo
					const demoSize = Math.round(centerMax * 0.45);
					state.center.size = Math.max(CENTER_MIN_SIZE, demoSize);
					if (centerSizeRange) {
						centerSizeRange.value = state.center.size;
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

	async function init() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		// Charger la configuration partagée si un paramètre share est présent
		await loadSharedConfig();

		const preview = configurator.querySelector(selectors.preview);
		const ringSizeInput = configurator.querySelector(selectors.slotSizeRange);
		const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
		const numbersToggle = configurator.querySelector(selectors.numbersToggle);
		const numbersColor = configurator.querySelector(selectors.numbersColor);
		const numbersSize = configurator.querySelector(selectors.numbersSize);
		const numbersDistanceInput = configurator.querySelector(selectors.numbersDistance);
		if (centerSizeRange) {
			const initialCenterSize = sharedConfigLoaded ? state.center.size : parseInt(centerSizeRange.value || 180, 10);
			const sanitized = Number.isNaN(initialCenterSize) ? (state.center.size || 180) : initialCenterSize;
			state.center.size = Math.max(CENTER_MIN_SIZE, sanitized);
			centerSizeRange.value = state.center.size;
		}

		if (numbersToggle && !sharedConfigLoaded) {
			state.showNumbers = !!numbersToggle.checked;
		}
		if (numbersToggle && sharedConfigLoaded) {
			numbersToggle.checked = !!state.showNumbers;
		}

		const showSlotsToggle = configurator.querySelector(selectors.showSlotsToggle);
		if (showSlotsToggle) {
			showSlotsToggle.checked = !!state.showSlots;
		}

		if (numbersColor && numbersColor.value && !sharedConfigLoaded) {
			state.numbers.color = numbersColor.value;
		}

		if (numbersSize) {
			const initialSize = sharedConfigLoaded ? state.numbers.size : parseInt(numbersSize.value || state.numbers.size, 10);
			if (!Number.isNaN(initialSize)) {
				state.numbers.size = Math.max(12, Math.min(96, initialSize));
			}
			numbersSize.value = state.numbers.size;
		}

		if (numbersDistanceInput) {
			const initialDistance = sharedConfigLoaded ? state.numbers.distance : parseInt(numbersDistanceInput.value || state.numbers.distance, 10);
			if (!Number.isNaN(initialDistance)) {
				state.numbers.distance = Math.max(0, initialDistance);
			}
			numbersDistanceInput.value = state.numbers.distance;
		}

		if (preview && ringSizeInput) {
			const initial = sharedConfigLoaded
				? state.ringSize
				: parseInt(preview.dataset.initialSlotSize || ringSizeInput.value || 80, 10);
			state.ringSize = initial;
			ringSizeInput.value = initial;
		}

		const slotBorderEnabled = configurator.querySelector(selectors.slotBorderEnabled);
		const slotBorderColor = configurator.querySelector(selectors.slotBorderColor);
		const slotBorderWidth = configurator.querySelector(selectors.slotBorderWidth);
		const slotShadowEnabled = configurator.querySelector(selectors.slotShadowEnabled);
		
		if (slotBorderEnabled) {
			state.slotBorder.enabled = !!slotBorderEnabled.checked;
		}
		if (slotBorderColor && slotBorderColor.value) {
			state.slotBorder.color = slotBorderColor.value;
		}
		if (slotBorderWidth) {
			const initialWidth = parseInt(slotBorderWidth.value || state.slotBorder.width, 10);
			if (!Number.isNaN(initialWidth)) {
				state.slotBorder.width = Math.max(1, Math.min(10, initialWidth));
			}
		}
		if (slotShadowEnabled) {
			state.slotShadow.enabled = !!slotShadowEnabled.checked;
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
			// Repositionner le panneau flottant si une photo périphérique est sélectionnée
			if (state.currentSlot && state.currentSlot !== 'center' && parseInt(state.currentSlot, 10) >= 1 && parseInt(state.currentSlot, 10) <= 12) {
				positionFloatingControls(state.currentSlot);
			}
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

// Fonctions de partage
let currentShareUrl = '';

function setShareLoadingState(isLoading, shareBtn) {
	shareLoading = !!isLoading;
	if (!shareBtn) {
		return;
	}
	if (!shareBtn.dataset.originalText) {
		shareBtn.dataset.originalText = shareBtn.textContent.trim();
	}
	if (shareLoading) {
		shareBtn.disabled = true;
		shareBtn.innerHTML = `<span class="wc-pc13-spinner"></span> ${shareBtn.dataset.originalText}`;
	} else {
		shareBtn.disabled = false;
		shareBtn.innerHTML = shareBtn.dataset.originalText || shareBtn.textContent;
	}
}

async function openShareModal(shareBtn = null) {
	const configurator = document.querySelector(selectors.configurator);
	if (!configurator) {
		return;
	}

	const productId = configurator.dataset.product;
	if (!productId) {
		window.alert('ID produit manquant');
		return;
	}

	const shareModal = configurator.querySelector(selectors.shareModal);
	const shareUrlInput = configurator.querySelector(selectors.shareUrlInput);

	// Afficher le modal rapidement avec un état de chargement
	if (shareModal) {
		shareModal.style.display = 'flex';
	}
	if (shareUrlInput) {
		shareUrlInput.value = WCPC13.labels?.loading || 'Génération du lien...';
		shareUrlInput.disabled = true;
	}
	setShareLoadingState(true, shareBtn);

	// Sauvegarder la configuration et obtenir le lien de partage
	try {
		const payload = savePayload();
		
		// Vérifier que le payload est valide
		if (!payload || typeof payload !== 'object') {
			throw new Error('Configuration invalide : payload manquant');
		}
		
		const payloadJson = JSON.stringify(payload);
		if (!payloadJson || payloadJson === '{}') {
			throw new Error('Configuration invalide : payload vide');
		}
		
		const formData = new FormData();
		formData.append('action', 'wc_pc13_save_share');
		formData.append('nonce', WCPC13.nonce);
		formData.append('product_id', productId);
		formData.append('payload', payloadJson);

		const response = await fetch(WCPC13.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData,
		});

		if (!response.ok) {
			throw new Error('Erreur lors de la sauvegarde');
		}

		const data = await response.json();
		if (!data || !data.success || !data.data) {
			throw new Error(data?.data?.message || 'Erreur lors de la sauvegarde');
		}

		currentShareUrl = data.data.share_url || '';
		if (shareUrlInput) {
			shareUrlInput.value = currentShareUrl;
			shareUrlInput.disabled = false;
		}

		// Mettre à jour les liens de partage social
		updateSocialShareLinks();

		// Afficher le modal (déjà affiché, mais on s'assure de l'état)
		if (shareModal) {
			shareModal.style.display = 'flex';
		}
	} catch (error) {
		console.error('Erreur lors de l\'ouverture du modal de partage:', error);
		window.alert(error?.message || 'Erreur lors de la génération du lien de partage');
		if (shareModal) {
			shareModal.style.display = 'none';
		}
	} finally {
		setShareLoadingState(false, shareBtn);
	}
}

async function saveShareAndSendEmail(email, triggerBtn = null) {
	const configurator = document.querySelector(selectors.configurator);
	if (!configurator) {
		return;
	}

	const productId = configurator.dataset.product;
	if (!productId) {
		window.alert('ID produit manquant');
		return;
	}

	setShareLoadingState(true, triggerBtn);
	try {
		const payload = savePayload();
		if (!payload || typeof payload !== 'object') {
			throw new Error('Configuration invalide : payload manquant');
		}

		const payloadJson = JSON.stringify(payload);
		if (!payloadJson || payloadJson === '{}') {
			throw new Error('Configuration invalide : payload vide');
		}

		const formData = new FormData();
		formData.append('action', 'wc_pc13_save_share_email');
		formData.append('nonce', WCPC13.nonce);
		formData.append('product_id', productId);
		formData.append('payload', payloadJson);
		formData.append('email', email);

		const response = await fetch(WCPC13.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData,
		});

		if (!response.ok) {
			throw new Error('Erreur lors de la sauvegarde');
		}

		const data = await response.json();
		if (!data || !data.success || !data.data) {
			throw new Error(data?.data?.message || 'Erreur lors de la sauvegarde');
		}

		currentShareUrl = data.data.share_url || '';
		window.alert(WCPC13.labels?.email_sent || 'Lien envoyé par email.');
	} catch (error) {
		console.error('Erreur lors de l’envoi du lien par email:', error);
		window.alert(error?.message || 'Erreur lors de l’envoi du lien par email');
	} finally {
		setShareLoadingState(false, triggerBtn);
	}
}

	function closeShareModal() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}
		const shareModal = configurator.querySelector(selectors.shareModal);
		if (shareModal) {
			shareModal.style.display = 'none';
		}
	}

	function copyShareLink() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}
		const shareUrlInput = configurator.querySelector(selectors.shareUrlInput);
		if (!shareUrlInput || !shareUrlInput.value) {
			return;
		}

		shareUrlInput.select();
		shareUrlInput.setSelectionRange(0, 99999); // Pour mobile

		try {
			document.execCommand('copy');
			const copyBtn = configurator.querySelector(selectors.copyLinkBtn);
			if (copyBtn) {
				const originalText = copyBtn.textContent;
				copyBtn.textContent = '✓ Copié';
				setTimeout(() => {
					copyBtn.textContent = originalText;
				}, 2000);
			}
		} catch (error) {
			console.error('Erreur lors de la copie:', error);
		}
	}

	function updateSocialShareLinks() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator || !currentShareUrl) {
			return;
		}

		const productTitle = document.querySelector('.product_title')?.textContent || 'Mon horloge personnalisée';
		const shareText = encodeURIComponent(`Découvrez mon horloge personnalisée : ${productTitle}`);

		// Email
		const shareEmailBtn = configurator.querySelector(selectors.shareEmail);
		if (shareEmailBtn) {
			shareEmailBtn.href = `mailto:?subject=${encodeURIComponent(productTitle)}&body=${encodeURIComponent(`Découvrez mon horloge personnalisée :\n${currentShareUrl}`)}`;
		}

		// WhatsApp
		const shareWhatsappBtn = configurator.querySelector(selectors.shareWhatsapp);
		if (shareWhatsappBtn) {
			shareWhatsappBtn.href = `https://wa.me/?text=${shareText}%20${encodeURIComponent(currentShareUrl)}`;
		}

		// Facebook
		const shareFacebookBtn = configurator.querySelector(selectors.shareFacebook);
		if (shareFacebookBtn) {
			shareFacebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}`;
		}

		// X (anciennement Twitter)
		const shareXBtn = configurator.querySelector(selectors.shareX);
		if (shareXBtn) {
			shareXBtn.href = `https://x.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(currentShareUrl)}`;
		}
	}

	function shareViaEmail() {
		// Le lien est déjà mis à jour dans updateSocialShareLinks
	}

	function shareViaWhatsapp() {
		// Le lien est déjà mis à jour dans updateSocialShareLinks
	}

	function shareViaFacebook() {
		// Le lien est déjà mis à jour dans updateSocialShareLinks
	}

	function shareViaX() {
		// Le lien est déjà mis à jour dans updateSocialShareLinks
	}

	// Charger la configuration depuis l'URL si un paramètre share est présent
	async function loadSharedConfig() {
		const urlParams = new URLSearchParams(window.location.search);
		const shareId = urlParams.get('share');
		if (!shareId) {
			return;
		}

		try {
			const formData = new FormData();
			formData.append('action', 'wc_pc13_load_share');
			formData.append('nonce', WCPC13.nonce);
			formData.append('share_id', shareId);

			const response = await fetch(WCPC13.ajax_url, {
				method: 'POST',
				credentials: 'same-origin',
				body: formData,
			});

			if (!response.ok) {
				throw new Error('Erreur lors du chargement');
			}

			const data = await response.json();
			if (!data || !data.success || !data.data) {
				throw new Error(data?.data?.message || 'Configuration introuvable');
			}

			const sharedConfig = data.data.config;
			if (!sharedConfig || !isObject(sharedConfig)) {
				return;
			}

			// Charger la configuration partagée
			if (sharedConfig.center) {
				state.center = { ...state.center, ...sharedConfig.center };
			}
			if (sharedConfig.slots) {
				state.slots = { ...state.slots, ...sharedConfig.slots };
			}
			if (sharedConfig.color) {
				state.color = sharedConfig.color;
			}
			if (sharedConfig.diameter) {
				state.diameter = sharedConfig.diameter;
			}
			if (sharedConfig.secondHand) {
				state.secondHand = sharedConfig.secondHand;
			}
			if (sharedConfig.ringSize) {
				state.ringSize = sharedConfig.ringSize;
			}
			if (sharedConfig.showNumbers !== undefined) {
				state.showNumbers = sharedConfig.showNumbers;
			}
			if (sharedConfig.numbers) {
				state.numbers = { ...state.numbers, ...sharedConfig.numbers };
			}
			if (sharedConfig.slot_border) {
				state.slotBorder = { ...state.slotBorder, ...sharedConfig.slot_border };
			}
			if (sharedConfig.slot_shadow) {
				state.slotShadow = { ...state.slotShadow, ...sharedConfig.slot_shadow };
			}
			if (sharedConfig.show_slots !== undefined) {
				state.showSlots = !!sharedConfig.show_slots;
			}

			// Appliquer la configuration
			applyStateToUI();
			updatePreview();
			sharedConfigLoaded = true;
		} catch (error) {
			console.error('Erreur lors du chargement de la configuration partagée:', error);
			// Ne pas afficher d'alerte pour ne pas perturber l'utilisateur
		}
	}

	function isObject(value) {
		return value !== null && typeof value === 'object' && !Array.isArray(value);
	}

	function applyStateToUI() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		// Appliquer la couleur
		const colorInput = configurator.querySelector(selectors.colorInput);
		if (colorInput && state.color) {
			colorInput.value = state.color;
			updateHandsColor();
		}

		// Appliquer le diamètre
		const diameterSelect = configurator.querySelector('#wc-pc13-diameter');
		if (diameterSelect && state.diameter) {
			diameterSelect.value = state.diameter;
		}

		// Appliquer la trotteuse
		const secondHandSelect = configurator.querySelector('#wc-pc13-second-hand');
		if (secondHandSelect && state.secondHand) {
			secondHandSelect.value = state.secondHand;
			updateSecondHand();
		}

		// Appliquer les styles de bordure et d'ombre
		const slotBorderEnabled = configurator.querySelector(selectors.slotBorderEnabled);
		const slotBorderColor = configurator.querySelector(selectors.slotBorderColor);
		const slotBorderWidth = configurator.querySelector(selectors.slotBorderWidth);
		const slotBorderFields = configurator.querySelector(selectors.slotBorderFields);
		const slotShadowEnabled = configurator.querySelector(selectors.slotShadowEnabled);
		
		if (slotBorderEnabled) {
			slotBorderEnabled.checked = !!state.slotBorder.enabled;
			if (slotBorderFields) {
				slotBorderFields.style.display = state.slotBorder.enabled ? 'block' : 'none';
			}
		}
		if (slotBorderColor && state.slotBorder.color) {
			slotBorderColor.value = state.slotBorder.color;
		}
		if (slotBorderWidth && state.slotBorder.width) {
			slotBorderWidth.value = state.slotBorder.width;
		}
		if (slotShadowEnabled) {
			slotShadowEnabled.checked = !!state.slotShadow.enabled;
		}

		// Appliquer les images
		updatePreview();
	}

	$(init);
})(jQuery);

