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

	/**
	 * Vérifie si une URL d'image est valide en tentant de la charger.
	 * Nettoie automatiquement les URLs invalides du state.
	 */
	function validateImageUrl(url, slotKey) {
		if (!url || !url.trim()) {
			return Promise.resolve(false);
		}

		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve(true);
			};
			img.onerror = () => {
				// Image introuvable (404), nettoyer le state silencieusement
				if (slotKey === 'center') {
					state.center.image_url = '';
					state.center.image_url_display = '';
					state.center.attachment_id = 0;
				} else if (slotKey && state.slots[slotKey]) {
					state.slots[slotKey].image_url = '';
					state.slots[slotKey].image_url_display = '';
					state.slots[slotKey].attachment_id = 0;
				}
				resolve(false);
			};
			img.src = url;
		});
	}

	/**
	 * Valide toutes les images du state et nettoie celles qui sont invalides.
	 */
	async function validateAllImages() {
		const validationPromises = [];

		// Valider l'image centrale
		if (state.center && state.center.image_url) {
			validationPromises.push(validateImageUrl(state.center.image_url, 'center'));
		}

		// Valider les images des slots périphériques
		Object.keys(state.slots).forEach((slotKey) => {
			const slot = state.slots[slotKey];
			if (slot && slot.image_url) {
				validationPromises.push(validateImageUrl(slot.image_url, slotKey));
			}
		});

		// Attendre que toutes les validations soient terminées
		await Promise.all(validationPromises);
	}

	// Convertir un nombre en chiffres romains (pour les nombres de 1 à 12)
	function toRoman(num) {
		const romanMap = {
			1: 'I',
			2: 'II',
			3: 'III',
			4: 'IV',
			5: 'V',
			6: 'VI',
			7: 'VII',
			8: 'VIII',
			9: 'IX',
			10: 'X',
			11: 'XI',
			12: 'XII'
		};
		return romanMap[num] || `${num}`;
	}

	// Obtenir le texte à afficher selon le type de chiffres et les points intermédiaires
	function getDialDisplayText(num, numberType, intermediatePoints) {
		// Si "avec points intermédiaires" est sélectionné, seules les heures 12, 3, 6, 9 affichent des chiffres
		// Les autres heures affichent des points
		if (intermediatePoints === 'with') {
			if (num === 12 || num === 3 || num === 6 || num === 9) {
				// Afficher le chiffre (arabe ou romain)
				if (numberType === 'roman') {
					return toRoman(num);
				}
				return `${num}`;
			}
			// Pour les autres heures, afficher un point
			return '•';
		}

		// Si "sans points intermédiaires", toutes les heures affichent des chiffres
		if (numberType === 'roman') {
			return toRoman(num);
		}

		return `${num}`;
	}

	function updateNumbersOverlay(configurator, ringRadius) {
		if (!configurator) {
			return;
		}
		const overlay = configurator.querySelector(selectors.numbersOverlay);
		if (!overlay) {
			return;
		}
		const labels = overlay.querySelectorAll(selectors.numbersOverlayLabel);
		// Le slider représente directement la distance depuis le centre
		// 0 = au centre, max = le plus éloigné (au bord)
		const numbersDistance = (typeof state.numbers.distance === 'number' && Number.isFinite(state.numbers.distance) && state.numbers.distance >= 0)
			? state.numbers.distance
			: 0; // Par défaut au centre
		// Calculer l'offset pour le CSS
		// Le CSS translateY(calc(-1 * var(--numbers-offset))) dans un contexte rotatif :
		// - offset positif → translateY(-positif) = vers le haut = vers le centre
		// - offset négatif → translateY(-négatif) = vers le bas = vers l'extérieur
		// Les chiffres sont positionnés au CENTRE par défaut (top: 50%, left: 50%)
		// Slider à gauche (0) = au centre : offset = 0 → pas de déplacement, reste au centre
		// Slider à droite (max) = au bord : offset = -max (négatif) → translateY(max) = vers l'extérieur
		// Donc : offset = -numbersDistance
		const numbersDelta = -numbersDistance;
		const numberType = state.numbers.numberType || 'arabic';
		const intermediatePoints = state.numbers.intermediatePoints || 'without';

		labels.forEach((label) => {
			const number = parseInt(label.dataset.number || label.textContent, 10);
			const displayText = getDialDisplayText(number, numberType, intermediatePoints);

			label.textContent = displayText;
			label.style.setProperty('--numbers-color', state.numbers.color || '#222222');
			label.style.setProperty('--numbers-size', `${state.numbers.size || 32}px`);
			label.style.setProperty('--numbers-offset', `${numbersDelta}px`);

			// Appliquer l'ombre portée
			const shadowEnabled = state.numbers.shadow && state.numbers.shadow.enabled === true;
			if (shadowEnabled) {
				const shadowIntensity = (state.numbers.shadow && state.numbers.shadow.intensity) || 5;
				const shadowValue = `0 ${shadowIntensity * 0.5}px ${shadowIntensity}px rgba(0, 0, 0, ${Math.min(0.8, 0.3 + shadowIntensity * 0.02)})`;
				label.style.setProperty('--numbers-shadow', shadowValue);
				label.setAttribute('data-shadow', 'true');
			} else {
				label.removeAttribute('data-shadow');
			}

			// Appliquer le halo lumineux
			const glowEnabled = state.numbers.glow && state.numbers.glow.enabled === true;
			if (glowEnabled) {
				const glowIntensity = (state.numbers.glow && state.numbers.glow.intensity) || 10;
				const glowColor = (state.numbers.glow && state.numbers.glow.color) || '#ffffff';
				// Utiliser une progression plus fluide : minimum 2px à intensité 1, maximum 60px à intensité 30
				// Formule : base + (intensité - 1) * facteur pour une progression linéaire mais avec minimum visible
				const baseGlow = 2; // Halo minimum visible même à intensité 1
				const maxGlow = 60; // Halo maximum à intensité 30
				const glowSize1 = baseGlow + ((glowIntensity - 1) / 29) * (maxGlow - baseGlow);
				const glowSize2 = baseGlow + ((glowIntensity - 1) / 29) * (maxGlow * 1.5 - baseGlow);
				const glowValue = `0 0 ${glowSize1}px ${glowColor}, 0 0 ${glowSize2}px ${glowColor}`;
				label.style.setProperty('--numbers-glow', glowValue);
				label.setAttribute('data-glow', 'true');
			} else {
				label.removeAttribute('data-glow');
			}
		});
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
			scale: 1.3,
			size: 280,
		},
		slots: Array.from({ length: 12 }, (_, index) => {
			// Répéter les images disponibles pour remplir les 12 slots
			const name = slotDemoNames[index % slotDemoNames.length] || centerDemoName;
			return {
				image_url: PLUGIN_URL && name ? `${PLUGIN_URL}assets/demo/${name}` : '',
				x: 0,
				y: 0,
				scale: 1.3,
			};
		}),
	};

	const MAX_SCALE = 5;
	const MIN_SCALE = 1;

	const state = {
		currentSlot: 'center',
		color: '#111111',
		backgroundColor: '#ffffff',
		secondHand: 'black', // 'red', 'black', ou 'none'
		diameter: 40, // Diamètre par défaut en cm
		diameterPrice: 59, // Prix par défaut pour 40 cm
		slots: {},
		center: {
			attachment_id: 0,
			image_url: '',
			image_url_display: '', // URL pour l'affichage (thumbnail)
			x: 0,
			y: 0,
			scale: 1.3,
			size: 180,
		},
		ringSize: 110,
		centerMax: 520,
		showNumbers: true,
		numbers: {
			color: '#222222',
			size: 32,
			distance: 0, // 0 = au centre, max = à l'extrémité
			numberType: 'arabic', // 'arabic' ou 'roman'
			intermediatePoints: 'without', // 'with' ou 'without'
			shadow: {
				enabled: false,
				intensity: 5, // 0-20
			},
			glow: {
				enabled: false,
				intensity: 10, // 0-30
				color: '#ffffff', // Couleur par défaut du halo (blanc)
			},
		},
		slotBorder: {
			enabled: false,
			color: '#000000',
			width: 2,
		},
		slotShadow: {
			enabled: false,
		},
		showSlots: (typeof WCPC13 !== 'undefined' && WCPC13.settings && typeof WCPC13.settings.default_show_slots !== 'undefined')
			? WCPC13.settings.default_show_slots
			: true,
	};

	function clampTransformValues(target) {
		const transform = target || {};

		// Vérifier si c'est l'image centrale en mode sans photos périphériques
		const isCenterOnly = (state && state.center === target && !state.showSlots);

		// Si c'est le cas, on autorise un dézoom plus important (jusqu'à 0.1)
		const effectiveMinScale = isCenterOnly ? 0.1 : MIN_SCALE;

		const rawScale = Number.isFinite(transform.scale) ? transform.scale : effectiveMinScale;
		const safeScale = Math.min(Math.max(rawScale, effectiveMinScale), MAX_SCALE);
		transform.scale = safeScale;

		// Si ce n'est PAS le mode centre seul, on empêche le déplacement si le zoom est <= 1
		if (!isCenterOnly && safeScale <= 1) {
			transform.x = 0;
			transform.y = 0;
			return { x: 0, y: 0, scale: safeScale, maxOffset: 0 };
		}

		// Calculer l'offset max autorisé
		let maxOffset;

		if (isCenterOnly) {
			// En mode centre seul, on autorise toujours un déplacement de 50% dans toutes les directions
			// même si l'image est dézoomée
			maxOffset = 50;
		} else {
			// Comportement standard : l'offset dépend du zoom (plus on zoom, plus on peut bouger)
			maxOffset = (safeScale - 1) * 50;
		}

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
							backgroundColor: state.backgroundColor || '#ffffff',
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

			// Créer une vignette de taille fixe (300x300px) pour le panier
			const thumbnailSize = 300;
			const thumbnailCanvas = document.createElement('canvas');
			thumbnailCanvas.width = thumbnailSize;
			thumbnailCanvas.height = thumbnailSize;
			const thumbnailCtx = thumbnailCanvas.getContext('2d');

			// Dessiner le canvas original redimensionné dans la vignette
			thumbnailCtx.drawImage(canvas, 0, 0, thumbnailSize, thumbnailSize);

			const blob = await canvasToJpegBlob(thumbnailCanvas, 0.75);

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
		// Match CSS background-size: (scale * 100)% which is width-based
		// CSS background-size percentage uses container width as reference
		const widthScale = baseSize / image.naturalWidth;
		const scale = widthScale * (transformState?.scale || 1);
		const drawWidth = image.naturalWidth * scale;
		const drawHeight = image.naturalHeight * scale;

		// Match CSS background-position: (50 + x)% (50 + y)%
		// CSS background-position percentage formula: position = (containerSize - imageSize) * percentage
		const xPercent = 50 + (transformState?.x || 0);
		const yPercent = 50 + (transformState?.y || 0);
		const offsetX = (baseSize - drawWidth) * (xPercent / 100);
		const offsetY = (baseSize - drawHeight) * (yPercent / 100);

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
		// Le slider représente directement la distance depuis le centre (0 = au centre, max = le plus éloigné)
		const numbersDistanceScreen = (typeof state.numbers.distance === 'number' && Number.isFinite(state.numbers.distance) && state.numbers.distance >= 0)
			? state.numbers.distance
			: 0; // Par défaut au centre
		const numbersRadius = numbersDistanceScreen * scaleFactor;

		const canvas = document.createElement('canvas');
		canvas.width = outputSize;
		canvas.height = outputSize;
		const ctx = canvas.getContext('2d');
		// Fond blanc pour toute la toile
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, outputSize, outputSize);

		const centerX = outputSize / 2;
		const centerY = outputSize / 2;

		// Dessiner le cercle de fond de l'horloge
		ctx.save();
		ctx.fillStyle = state.backgroundColor || '#ffffff';
		ctx.beginPath();
		ctx.arc(centerX, centerY, outputSize / 2, 0, Math.PI * 2);
		ctx.closePath();
		ctx.fill();
		ctx.restore();

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
					image_url: '', // URL complète pour le PDF/export
					image_url_display: '', // URL thumbnail pour l'affichage (optimisation performance)
					x: 0,
					y: 0,
					scale: 1,
				};
			}
			const domInfo = slotDomMap.get(i) || {};
			// Prioriser l'URL du DOM si elle existe, sinon utiliser celle du state
			// Pour l'affichage, utiliser image_url_display si disponible
			const displayUrl = state.slots[i].image_url_display || state.slots[i].image_url || '';
			const resolvedUrl = (domInfo.imageUrl && domInfo.imageUrl.trim()) || displayUrl;
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
			// Calculer l'angle pour positionner le slot 12 en haut (comme une vraie horloge)
			// Si le 6 est actuellement en haut (à 180°), il faut décaler de 180° pour avoir le 12 en haut
			// Formule: angle = ((index == 12 ? 0 : index) * 30 + 180) % 360
			const baseAngle = (entry.index === 12 ? 0 : entry.index) * 30;
			const angleDeg = (baseAngle + 180) % 360;
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
				shadowEnabled: false, // L'ombre portée s'applique uniquement aux images périphériques
				borderEnabled: state.slotBorder?.enabled || false,
				borderWidth: state.slotBorder?.width || 2,
				borderColor: state.slotBorder?.color || '#000000',
			});
		}

		if (state.showNumbers) {
			ctx.save();
			const numberType = state.numbers.numberType || 'arabic';
			const intermediatePoints = state.numbers.intermediatePoints || 'without';
			const fontSizePx = Math.max(12, state.numbers.size || 32) * scaleFactor;
			ctx.font = `${Math.round(fontSizePx)}px "Helvetica Neue", "Arial", sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';

			// Préparer les effets d'ombre et halo
			const shadowEnabled = state.numbers.shadow && state.numbers.shadow.enabled;
			const shadowIntensity = shadowEnabled ? (state.numbers.shadow.intensity || 5) : 0;
			const glowEnabled = state.numbers.glow && state.numbers.glow.enabled;
			const glowIntensity = glowEnabled ? (state.numbers.glow.intensity || 10) : 0;
			const glowColor = glowEnabled ? ((state.numbers.glow && state.numbers.glow.color) || '#ffffff') : null;
			const numberColor = state.numbers.color || '#222222';

			for (let i = 1; i <= 12; i++) {
				// Calculer l'angle pour positionner le 12 en haut (comme une vraie horloge)
				// Avec translateY(-radius) dans le calcul, l'angle 0° place l'élément en haut
				// Puis on tourne dans le sens horaire: 12h=0°, 3h=90°, 6h=180°, 9h=270°
				// Formule identique aux slots: angle = (i === 12 ? 0 : i) * 30
				const angleDeg = (i === 12 ? 0 : i) * 30;
				const angleRad = (angleDeg * Math.PI) / 180;
				const numberX = centerX + Math.sin(angleRad) * numbersRadius;
				const numberY = centerY - Math.cos(angleRad) * numbersRadius;

				const displayText = getDialDisplayText(i, numberType, intermediatePoints);

				// Dessiner le halo lumineux d'abord (derrière)
				if (glowEnabled && glowIntensity > 0 && glowColor) {
					ctx.save();
					// Utiliser une progression plus fluide : minimum 2px à intensité 1, maximum 60px à intensité 30
					// Formule : base + (intensité - 1) * facteur pour une progression linéaire mais avec minimum visible
					const baseGlow = 2; // Halo minimum visible même à intensité 1
					const maxGlow = 60; // Halo maximum à intensité 30
					const glowBlur = (baseGlow + ((glowIntensity - 1) / 29) * (maxGlow - baseGlow)) * scaleFactor;
					ctx.shadowBlur = glowBlur;
					ctx.shadowColor = glowColor;
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 0;
					ctx.fillStyle = numberColor;
					ctx.fillText(displayText, numberX, numberY);
					ctx.restore();
				}

				// Dessiner l'ombre portée
				if (shadowEnabled && shadowIntensity > 0) {
					ctx.save();
					ctx.shadowBlur = shadowIntensity * scaleFactor;
					ctx.shadowColor = `rgba(0, 0, 0, ${0.3 + shadowIntensity * 0.02})`;
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = shadowIntensity * 0.5 * scaleFactor;
					ctx.fillStyle = numberColor;
					ctx.fillText(displayText, numberX, numberY);
					ctx.restore();
				}

				// Dessiner le texte principal
				ctx.fillStyle = numberColor;
				ctx.fillText(displayText, numberX, numberY);
			}
			ctx.restore();
		}

		// Dessiner le cercle de fond de l'horloge
		// Pas de bordure pour le PDF HD

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

		// Indiquer le début de la génération dans l'interface
		const pdfBtn = configurator.querySelector(selectors.downloadPdf);
		if (pdfBtn) {
			pdfBtn.classList.remove('wc-pc13-pdf-ready');
			pdfBtn.classList.add('wc-pc13-pdf-generating');
			pdfBtn.disabled = true;

			const pdfText = pdfBtn.querySelector('.wc-pc13-pdf-text');
			if (pdfText) {
				pdfText.textContent = 'Préparation PDF HD...';
			}

			const spinner = pdfBtn.querySelector('.wc-pc13-pdf-spinner');
			if (spinner) {
				spinner.style.display = 'inline-block';
			}
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

		// Mettre à jour l'interface pour indiquer que le PDF est prêt
		updateCartFragments();

		return data.data;
	}

	async function downloadAsPdf() {
		const pdfBtn = document.querySelector(selectors.downloadPdf);
		const spinner = pdfBtn?.querySelector('.wc-pc13-pdf-spinner');
		const text = pdfBtn?.querySelector('.wc-pc13-pdf-text');
		const originalText = text ? text.textContent : '';

		try {
			if (pdfBtn) {
				pdfBtn.disabled = true;
				if (spinner) spinner.style.display = 'inline-block';
				if (text) text.textContent = 'Génération PDF...';
			}

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
			console.error('Erreur PDF:', error);
			window.alert(error.message || WCPC13.labels.download_error || 'Téléchargement impossible');
		} finally {
			if (pdfBtn) {
				pdfBtn.disabled = false;
				if (spinner) spinner.style.display = 'none';
				if (text) text.textContent = originalText;
			}
		}
	}

	const selectors = {
		configurator: '.wc-pc13-configurator',
		helpBtn: '.wc-pc13-help-btn',
		helpModal: '.wc-pc13-help-modal',
		helpModalClose: '.wc-pc13-help-modal-close',
		helpModalCancel: '.wc-pc13-help-modal-cancel',
		helpForm: '.wc-pc13-help-form',
		helpModalMessage: '.wc-pc13-help-modal-message',
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
		backgroundColorInput: '#wc-pc13-background-color',
		slotSizeRange: '#wc-pc13-slot-size',
		numbersToggle: '#wc-pc13-show-numbers',
		numberType: '#wc-pc13-number-type',
		intermediatePoints: '#wc-pc13-intermediate-points',
		numbersColor: '#wc-pc13-number-color',
		numbersSize: '#wc-pc13-number-size',
		numbersDistance: '#wc-pc13-number-distance',
		numberShadowEnabled: '#wc-pc13-number-shadow-enabled',
		numberShadowIntensity: '#wc-pc13-number-shadow-intensity',
		numberShadowFields: '.wc-pc13-number-shadow-fields',
		numberGlowEnabled: '#wc-pc13-number-glow-enabled',
		numberGlowIntensity: '#wc-pc13-number-glow-intensity',
		numberGlowColor: '#wc-pc13-number-glow-color',
		numberGlowFields: '.wc-pc13-number-glow-fields',
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
		emailModal: '.wc-pc13-email-modal',
		emailModalClose: '.wc-pc13-email-modal-close',
		emailModalCancel: '.wc-pc13-email-modal-cancel',
		emailModalSubmit: '.wc-pc13-email-modal-submit',
		emailInput: '#wc-pc13-email-input',
		showSlotsToggle: '#wc-pc13-show-slots',
		slotStyling: '.wc-pc13-slot-styling',
		numbersOverlay: '.wc-pc13-numbers-overlay',
		numbersOverlayLabel: '.wc-pc13-number-label',
		livePreviewImage: '.wc-pc13-live-preview-image',
		livePreviewPlaceholder: '.wc-pc13-live-preview-placeholder',
		fillUnsplash: '.wc-pc13-fill-unsplash',
		searchUnsplashBtn: '.wc-pc13-search-unsplash-btn',
		unsplashModal: '#wc-pc13-unsplash-modal',
		unsplashModalClose: '.wc-pc13-unsplash-modal-close',
		unsplashModalOverlay: '.wc-pc13-unsplash-modal-overlay',
		unsplashSearchInput: '#wc-pc13-unsplash-search-input',
		unsplashSearchSubmit: '.wc-pc13-unsplash-search-submit',
		unsplashResults: '#wc-pc13-unsplash-results',
		unsplashGrid: '.wc-pc13-unsplash-grid',
		unsplashLoading: '.wc-pc13-unsplash-loading',
		unsplashEmpty: '.wc-pc13-unsplash-empty',
		slotBorderEnabled: '#wc-pc13-slot-border-enabled',
		slotBorderColor: '#wc-pc13-slot-border-color',
		slotBorderWidth: '#wc-pc13-slot-border-width',
		slotBorderFields: '.wc-pc13-slot-border-fields',
		slotShadowEnabled: '#wc-pc13-slot-shadow-enabled',
		arBtn: '.wc-pc13-ar-btn',
		arModal: '#wc-pc13-ar-modal',
		arModalClose: '.wc-pc13-ar-modal-close',
		arVideo: '#wc-pc13-ar-video',
		arClockOverlay: '#wc-pc13-ar-clock-overlay',
		arClockImage: '#wc-pc13-ar-clock-image',
		arSize: '#wc-pc13-ar-size',
		arCapture: '.wc-pc13-ar-capture',
		arReset: '.wc-pc13-ar-reset',
		arError: '.wc-pc13-ar-error',
	};

	function updateRingDimensions(syncNumbers = false) {
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

		// Afficher/masquer les contrôles liés aux slots
		const slotSizeLabel = configurator.querySelector('label[for="wc-pc13-slot-size"]');
		const slotSizeInput = configurator.querySelector('#wc-pc13-slot-size');
		const slotStyling = configurator.querySelector(selectors.slotStyling);
		const previewHint = configurator.querySelector('.wc-pc13-preview-hint');
		const displayValue = state.showSlots ? '' : 'none';
		if (slotSizeLabel) {
			slotSizeLabel.style.display = displayValue;
		}
		if (slotSizeInput) {
			slotSizeInput.style.display = displayValue;
		}
		if (slotStyling) {
			slotStyling.style.display = displayValue;
		}
		// Afficher/masquer le message d'aide selon l'état des photos périphériques
		if (previewHint) {
			previewHint.style.display = state.showSlots ? 'block' : 'none';
		}

		state.currentRingRadius = radius;
		// Note: updateNumbersOverlay n'est PAS appelé ici car les chiffres sont indépendants des slots
		// Les chiffres sont mis à jour dans applyTransforms() quand nécessaire

		// Recalculer le max du slider de distance des chiffres pour qu'il corresponde au bord du cadran
		const numbersDistanceInput = configurator.querySelector('#wc-pc13-number-distance');
		if (numbersDistanceInput) {
			const previewWidth = preview.offsetWidth || 360;
			// La distance maximale est jusqu'au bord du cadran (moins une petite marge)
			const edgeDistance = (previewWidth / 2) - 10; // -10px de marge pour éviter que les chiffres touchent le bord
			const maxDistance = Math.max(edgeDistance, 50); // Minimum 50px
			numbersDistanceInput.max = `${Math.round(maxDistance)}`;

			// Si on demande la synchronisation ou si c'est la première fois qu'on active les slots
			if (syncNumbers && state.showSlots && state.showNumbers) {
				state.numbers.distance = radius;
			}

			// S'assurer que la valeur actuelle ne dépasse pas le nouveau max
			let currentValue = (typeof state.numbers.distance === 'number' && Number.isFinite(state.numbers.distance)) ? state.numbers.distance : 0;

			// Si la valeur est 0 (non définie) et qu'on a des slots, on centre sur le radius
			if (currentValue === 0 && maxDistance > 0) {
				currentValue = state.showSlots ? radius : Math.round(maxDistance * 0.9);
				state.numbers.distance = currentValue;
			}

			if (currentValue > maxDistance) {
				currentValue = maxDistance;
				state.numbers.distance = maxDistance;
			}
			numbersDistanceInput.value = currentValue;

			// Mettre à jour l'affichage de la valeur en pourcentage
			const valueDisplay = configurator.querySelector('#wc-pc13-number-distance-value');
			if (valueDisplay && maxDistance > 0) {
				const percentage = Math.round((currentValue / maxDistance) * 100);
				valueDisplay.textContent = `${percentage}%`;
			}
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

		// Si les photos périphériques sont désactivées, mettre la taille au maximum
		if (!state.showSlots) {
			state.center.size = state.centerMax;
		} else if (state.center.size > state.centerMax) {
			state.center.size = state.centerMax;
		}

		centerSizeRange.value = state.center.size;

		// Mettre à jour l'affichage du pourcentage
		const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
		if (valueDisplay && state.centerMax > 0) {
			const percentage = Math.round((state.center.size / state.centerMax) * 100);
			valueDisplay.textContent = `${percentage}%`;
		}

		return previous !== state.center.size;
	}

	function initSlots() {
		for (let i = 1; i <= 12; i++) {
			state.slots[i] = {
				attachment_id: 0,
				image_url: '', // URL complète pour le PDF/export
				image_url_display: '', // URL thumbnail pour l'affichage (optimisation performance)
				x: 0,
				y: 0,
				scale: 1.3,
			};
		}
	}

	function getCurrentSlotState() {
		if (state.currentSlot === 'center') {
			return state.center;
		}
		// S'assurer que le slot existe, sinon l'initialiser
		const slotKey = typeof state.currentSlot === 'number' ? state.currentSlot : parseInt(state.currentSlot, 10);
		if (!state.slots[slotKey]) {
			state.slots[slotKey] = {
				attachment_id: 0,
				image_url: '',
				image_url_display: '',
				x: 0,
				y: 0,
				scale: 1,
			};
		}
		return state.slots[slotKey];
	}

	// Variable pour suivre si on est en train de déplacer (drag actif)
	let isDragging = false;

	function applyTransforms(skipExpensiveUpdates = false) {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const previewEl = configurator.querySelector(selectors.preview);
		if (previewEl) {
			previewEl.classList.toggle('show-numbers', !!state.showNumbers);
		}

		// Mettre à jour la couleur de fond
		updateBackgroundColor();

		// Éviter updateRingDimensions pendant le drag (coûteux)
		if (!skipExpensiveUpdates) {
			updateRingDimensions();
		}

		// Parcourir tous les slots (1-12) pour s'assurer qu'ils sont tous mis à jour
		for (let i = 1; i <= 12; i++) {
			const slotState = state.slots[i];
			if (!slotState) {
				continue;
			}

			const slotKeyStr = String(i);
			const slot = configurator.querySelector(`${selectors.slot}[data-slot="${slotKeyStr}"] ${selectors.slotImage}`);
			const slotInner = configurator.querySelector(`${selectors.slot}[data-slot="${slotKeyStr}"] .wc-pc13-slot-inner`);
			if (!slot) {
				// Ne pas logger pour les slots qui n'existent pas encore
				continue;
			}

			// Debug pour vérifier que l'image est bien définie
			if (slotState.image_url) {
				console.log('applyTransforms - Slot', i, 'a une image:', slotState.image_url, 'display:', slotState.image_url_display);
			}

			// Afficher l'image si elle existe (peu importe showSlots, car l'image peut être chargée même si les slots sont masqués)
			if (slotState.image_url) {
				// Utiliser image_url_display (thumbnail) pour l'affichage si disponible, sinon image_url
				const displayUrl = slotState.image_url_display || slotState.image_url;
				if (displayUrl) {
					// S'assurer que l'URL est correctement formatée
					const imageUrl = displayUrl.trim();
					if (imageUrl) {
						slot.style.backgroundImage = `url("${imageUrl}")`;
						slot.style.backgroundRepeat = 'no-repeat';
						slot.style.backgroundSize = 'cover';
						slot.classList.remove('empty');
						if (slotInner) {
							slotInner.classList.add('has-image');
						}
						console.log('applyTransforms - Image appliquée sur slot', i, 'URL:', imageUrl);
					} else {
						console.warn('applyTransforms - URL vide pour slot', i);
						slot.style.backgroundImage = '';
						slot.classList.add('empty');
						if (slotInner) {
							slotInner.classList.remove('has-image');
						}
					}
				} else {
					console.warn('applyTransforms - Pas de displayUrl pour slot', i);
					slot.style.backgroundImage = '';
					slot.classList.add('empty');
					if (slotInner) {
						slotInner.classList.remove('has-image');
					}
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

			// Appliquer les styles de background seulement si l'image existe
			if (slotState.image_url) {
				// Utiliser le scale pour le backgroundSize (scale * 100% pour zoomer)
				const backgroundSizeValue = `${scale * 100}%`;
				slot.style.backgroundSize = backgroundSizeValue;
				slot.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
				slot.style.backgroundRepeat = 'no-repeat';
				// S'assurer que l'image est visible
				slot.style.opacity = '1';
				slot.style.visibility = 'visible';

				// Debug pour vérifier que le scale est appliqué
				if (window.WCPC13_DEBUG) {
					console.log('applyTransforms - Slot', i, 'scale appliqué:', scale, 'backgroundSize:', backgroundSizeValue);
				}
			} else {
				// Si pas d'image, réinitialiser les styles
				slot.style.backgroundSize = '';
				slot.style.backgroundPosition = '';
				slot.style.backgroundRepeat = '';
			}

			// Utiliser requestAnimationFrame pour optimiser les mises à jour de backgroundPosition
			// qui sont coûteuses en termes de performance
			if (isDragging) {
				// Pendant le drag, désactiver les transitions pour de meilleures performances
				slot.style.transition = 'none';
			}
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
		}

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
				// Pour le centre, utiliser image_url_display si disponible, sinon image_url
				const centerDisplayUrl = state.center.image_url_display || state.center.image_url;
				centerEl.style.backgroundImage = `url(${centerDisplayUrl})`;
				centerEl.style.backgroundRepeat = 'no-repeat';
				centerEl.classList.remove('empty');

				// Pendant le drag, désactiver les transitions pour de meilleures performances
				if (isDragging) {
					centerEl.style.transition = 'none';
				}

				const { x, y, scale } = clampTransformValues(state.center);
				centerEl.style.transform = 'none';
				centerEl.style.backgroundSize = `${scale * 100}%`;
				// Pendant le drag, désactiver les transitions pour de meilleures performances
				if (isDragging) {
					centerEl.style.transition = 'none';
				}
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

		// Mettre à jour les chiffres des heures (utilise updateNumbersOverlay qui gère les nouveaux labels)
		const ringRadius = state.currentRingRadius || 0;
		updateNumbersOverlay(configurator, ringRadius);
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

		// Calculer le min scale autorisé
		const isCenterOnly = (state.currentSlot === 'center' && !state.showSlots);
		const minScale = isCenterOnly ? 0.1 : 1;

		if (zoomRange) {
			zoomRange.min = minScale;
			const scaleValue = current.scale || 1;
			zoomRange.value = scaleValue;
			console.log('updateSelectionUI - zoomRange mis à jour pour slot:', state.currentSlot, 'scale:', scaleValue);
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

			// Afficher ou masquer le label du slider selon si une image centrale est présente
			const centerSizeLabel = configurator.querySelector('.wc-pc13-center-size-label');
			if (centerSizeLabel) {
				if (state.center.image_url) {
					centerSizeLabel.style.display = 'block';
				} else {
					centerSizeLabel.style.display = 'none';
				}
			}

			// Afficher ou masquer les contrôles de zoom/position selon si une image centrale est présente
			const centerControls = configurator.querySelector('.wc-pc13-center-controls');
			if (centerControls) {
				if (state.center.image_url) {
					centerControls.style.display = 'block';

					// Mettre à jour les valeurs des contrôles
					const centerZoom = centerControls.querySelector('#wc-pc13-center-zoom');
					const centerAxisX = centerControls.querySelector('#wc-pc13-center-position-x');
					const centerAxisY = centerControls.querySelector('#wc-pc13-center-position-y');

					if (centerZoom) {
						centerZoom.min = minScale;
						centerZoom.value = state.center.scale || 1;
					}
					if (centerAxisX) {
						centerAxisX.value = -(state.center.x || 0);
					}
					if (centerAxisY) {
						centerAxisY.value = -(state.center.y || 0);
					}

					// Mettre à jour les labels des sliders
					// Pour centrer l'axe X/Y si on est dézoomé, on peut vouloir augmenter la plage
					// Mais on garde les valeurs fixes des inputs HTML pour l'instant (-50 à 50 ou -100 à 100)
					if (isCenterOnly) {
						if (centerAxisX) { centerAxisX.max = 100; centerAxisX.min = -100; }
						if (centerAxisY) { centerAxisY.max = 100; centerAxisY.min = -100; }
					} else {
						// Valeurs par défaut (supposées être 50 ou 100 dans le HTML)
						// On ne touche pas si pas nécessaire, mais ici on relaxe pour centerOnly
					}
				} else {
					centerControls.style.display = 'none';
				}
			}

			// Mettre à jour l'affichage du pourcentage
			const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
			if (valueDisplay && state.centerMax > 0) {
				const percentage = Math.round((state.center.size / state.centerMax) * 100);
				valueDisplay.textContent = `${percentage}%`;
			}
		}

		const numbersToggle = configurator.querySelector(selectors.numbersToggle);
		const numbersFields = configurator.querySelector(selectors.numbersFields);
		const numbersColor = configurator.querySelector(selectors.numbersColor);
		const numbersSize = configurator.querySelector(selectors.numbersSize);
		const numbersDistanceInput = configurator.querySelector(selectors.numbersDistance);
		const numberTypeSelect = configurator.querySelector(selectors.numberType);
		const intermediatePointsSelect = configurator.querySelector(selectors.intermediatePoints);
		const centerRemoveBtn = configurator.querySelector(selectors.centerRemoveButton);
		if (numbersToggle) {
			numbersToggle.checked = !!state.showNumbers;
		}
		const numbersEnabled = !!state.showNumbers;

		if (numbersFields) {
			numbersFields.classList.toggle('is-active', numbersEnabled);
			numbersFields.style.display = numbersEnabled ? 'flex' : 'none';
		}

		if (numbersColor) {
			numbersColor.value = state.numbers.color;
			numbersColor.disabled = !numbersEnabled;
		}

		if (numberTypeSelect) {
			numberTypeSelect.value = state.numbers.numberType || 'arabic';
			numberTypeSelect.disabled = !numbersEnabled;
		}

		if (intermediatePointsSelect) {
			intermediatePointsSelect.value = state.numbers.intermediatePoints || 'without';
			intermediatePointsSelect.disabled = !numbersEnabled;
		}

		const numberShadowEnabled = configurator.querySelector(selectors.numberShadowEnabled);
		const numberShadowIntensity = configurator.querySelector(selectors.numberShadowIntensity);
		const numberShadowFields = configurator.querySelector(selectors.numberShadowFields);

		if (numberShadowEnabled) {
			numberShadowEnabled.checked = !!(state.numbers.shadow && state.numbers.shadow.enabled);
			numberShadowEnabled.disabled = !numbersEnabled;
		}

		if (numberShadowIntensity) {
			numberShadowIntensity.value = (state.numbers.shadow && state.numbers.shadow.intensity) || 5;
			numberShadowIntensity.disabled = !numbersEnabled || !(state.numbers.shadow && state.numbers.shadow.enabled);
		}

		if (numberShadowFields) {
			numberShadowFields.style.display = (state.numbers.shadow && state.numbers.shadow.enabled) ? 'block' : 'none';
		}

		const numberGlowEnabled = configurator.querySelector(selectors.numberGlowEnabled);
		const numberGlowIntensity = configurator.querySelector(selectors.numberGlowIntensity);
		const numberGlowFields = configurator.querySelector(selectors.numberGlowFields);

		if (numberGlowEnabled) {
			numberGlowEnabled.checked = !!(state.numbers.glow && state.numbers.glow.enabled);
			numberGlowEnabled.disabled = !numbersEnabled;
		}

		if (numberGlowIntensity) {
			// S'assurer que le slider a les bonnes valeurs min/max (gauche = min, droite = max)
			numberGlowIntensity.min = '1';
			numberGlowIntensity.max = '30';
			numberGlowIntensity.value = (state.numbers.glow && state.numbers.glow.intensity) || 10;
			numberGlowIntensity.disabled = !numbersEnabled || !(state.numbers.glow && state.numbers.glow.enabled);
		}

		if (numberGlowFields) {
			numberGlowFields.style.display = (state.numbers.glow && state.numbers.glow.enabled) ? 'block' : 'none';
		}

		if (numbersSize) {
			// Ne pas modifier le slider s'il est en cours d'utilisation
			if (document.activeElement !== numbersSize) {
				numbersSize.value = state.numbers.size;
			}
			numbersSize.disabled = !numbersEnabled;
		}

		if (numbersDistanceInput) {
			// Ne pas modifier le slider s'il est en cours d'utilisation (pour éviter qu'il disparaisse)
			const isSliderActive = document.activeElement === numbersDistanceInput;

			let maxDistance = 350; // Valeur par défaut
			const preview = configurator.querySelector('.wc-pc13-preview');
			if (preview && state.currentRingRadius) {
				const previewWidth = preview.offsetWidth || 360;
				// La distance maximale est jusqu'au bord du cadran (moins une petite marge pour éviter que les chiffres touchent le bord)
				// Le bord du cadran est à previewWidth / 2 du centre
				const edgeDistance = (previewWidth / 2) - 10; // -10px de marge pour éviter que les chiffres touchent le bord
				maxDistance = Math.max(edgeDistance, 50); // Minimum 50px
				if (!isSliderActive) {
					numbersDistanceInput.min = '0';
					numbersDistanceInput.max = `${Math.round(maxDistance)}`;
				}
			} else if (state.currentRingRadius) {
				// Fallback si preview n'est pas disponible
				const ringRadius = state.currentRingRadius;
				maxDistance = Math.max(ringRadius + state.ringSize, state.center.size);
				if (!isSliderActive) {
					numbersDistanceInput.min = '0';
					numbersDistanceInput.max = `${Math.round(maxDistance)}`;
				}
			}
			// S'assurer que la valeur est au moins 0 (au centre) et ne dépasse pas le max
			const maxValue = parseInt(numbersDistanceInput.max, 10) || maxDistance;
			// Si la distance n'est pas définie ou est 0, utiliser 90% du max par défaut
			let currentValue = state.numbers.distance || 0;
			if (currentValue === 0 && maxValue > 0) {
				currentValue = Math.round(maxValue * 0.9); // 90% du max par défaut
				state.numbers.distance = currentValue;
			}
			currentValue = Math.max(0, Math.min(maxValue, currentValue));
			// Ne mettre à jour la valeur que si le slider n'est pas actif
			if (!isSliderActive && parseInt(numbersDistanceInput.value, 10) !== currentValue) {
				numbersDistanceInput.value = currentValue;
			}
			numbersDistanceInput.disabled = !numbersEnabled;

			// Mettre à jour l'affichage de la valeur en pourcentage
			const valueDisplay = configurator.querySelector('#wc-pc13-number-distance-value');
			if (valueDisplay && maxValue > 0) {
				const currentSliderValue = isSliderActive ? parseInt(numbersDistanceInput.value, 10) : currentValue;
				const percentage = Math.round((currentSliderValue / maxValue) * 100);
				valueDisplay.textContent = `${percentage}%`;
			}
		}

		if (centerRemoveBtn) {
			centerRemoveBtn.disabled = !state.center.image_url;
		}

		// Mettre à jour le bouton de sélection d'image centrale
		const centerSelectBtn = configurator.querySelector(selectors.centerSelectButton);
		if (centerSelectBtn) {
			if (state.center.image_url) {
				centerSelectBtn.textContent = 'Remplacer l\'image centrale…';
				centerSelectBtn.classList.remove('wc-pc13-no-image');
			} else {
				centerSelectBtn.textContent = 'Envoyer une image centrale';
				centerSelectBtn.classList.add('wc-pc13-no-image');
			}
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
					const scaleValue = current.scale || 1;
					floatingZoom.value = scaleValue;
					console.log('updateSelectionUI - floatingZoom mis à jour pour slot:', state.currentSlot, 'scale:', scaleValue);
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
			background_color: state.backgroundColor,
			second_hand: state.secondHand,
			diameter: state.diameter,
			diameter_price: state.diameterPrice || 59,
			slots: state.slots,
			center: state.center,
			ring_size: state.ringSize,
			show_slots: state.showSlots,
			show_numbers: state.showNumbers,
			numbers: {
				color: state.numbers.color,
				size: state.numbers.size,
				distance: state.numbers.distance,
				numberType: state.numbers.numberType || 'arabic',
				intermediatePoints: state.numbers.intermediatePoints || 'without',
				shadow: state.numbers.shadow || { enabled: false, intensity: 5 },
				glow: state.numbers.glow || { enabled: false, intensity: 10, color: '#ffffff' },
			},
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
			// Convertir en nombre si c'est un nombre valide
			if (typeof slot === 'string' && slot !== 'center' && !isNaN(parseInt(slot, 10))) {
				state.currentSlot = parseInt(slot, 10);
			} else {
				state.currentSlot = slot;
			}
		}
		console.log('selectSlot called - slot:', slot, 'state.currentSlot:', state.currentSlot);
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

	/**
	 * Redimensionne une image à 2000px max côté client pour les photos périphériques.
	 * @param {File} file - Fichier image à redimensionner
	 * @param {number} maxSize - Taille maximale en pixels (défaut: 2000)
	 * @param {number} quality - Qualité JPEG (0-1, défaut: 0.9)
	 * @returns {Promise<Blob>} - Blob de l'image redimensionnée
	 */
	function resizeImageForPeripheral(file, maxSize = 2000, quality = 0.9) {
		return new Promise((resolve, reject) => {
			// Vérifier que c'est une image
			if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/i)) {
				reject(new Error('Format d\'image non supporté'));
				return;
			}

			const img = new Image();
			const reader = new FileReader();

			reader.onload = function (e) {
				img.onload = function () {
					// Calculer les nouvelles dimensions en conservant le ratio
					let width = img.width;
					let height = img.height;

					// Si l'image est déjà plus petite que maxSize, retourner l'original
					if (width <= maxSize && height <= maxSize) {
						// Convertir le fichier en blob
						file.arrayBuffer().then(buffer => {
							resolve(new Blob([buffer], { type: file.type }));
						}).catch(reject);
						return;
					}

					// Calculer le ratio de redimensionnement
					const ratio = Math.min(maxSize / width, maxSize / height);
					const newWidth = Math.round(width * ratio);
					const newHeight = Math.round(height * ratio);

					// Créer un canvas pour redimensionner
					const canvas = document.createElement('canvas');
					canvas.width = newWidth;
					canvas.height = newHeight;
					const ctx = canvas.getContext('2d');

					// Dessiner l'image redimensionnée
					ctx.drawImage(img, 0, 0, newWidth, newHeight);

					// Convertir en blob JPEG (toujours en JPEG pour optimiser)
					canvas.toBlob((blob) => {
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('Erreur lors de la création de la vignette'));
						}
					}, 'image/jpeg', quality);
				};

				img.onerror = function () {
					reject(new Error('Erreur lors du chargement de l\'image'));
				};

				img.src = e.target.result;
			};

			reader.onerror = function () {
				reject(new Error('Erreur lors de la lecture du fichier'));
			};

			reader.readAsDataURL(file);
		});
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

	/**
	 * Calcule le zoom optimal pour qu'une image remplisse complètement un cercle
	 * @param {number} imageWidth - Largeur de l'image
	 * @param {number} imageHeight - Hauteur de l'image
	 * @param {number} circleSize - Taille du cercle (diamètre)
	 * @param {number} inset - Inset CSS appliqué (par défaut 14px)
	 * @returns {number} - Scale optimal
	 */
	function calculateOptimalZoomForCircle(imageWidth, imageHeight, circleSize, inset = DEFAULT_CENTER_INSET) {
		if (!imageWidth || !imageHeight || !circleSize) {
			return 1.5; // Valeur par défaut plus élevée pour éviter les blancs
		}

		const effectiveSize = circleSize - (2 * inset);

		// Pour remplir complètement un cercle, il faut que l'image couvre la boîte englobante
		// Calculer le ratio nécessaire pour que chaque dimension couvre au moins le diamètre du cercle
		const widthRatio = effectiveSize / imageWidth;
		const heightRatio = effectiveSize / imageHeight;

		// Pour un cercle, la diagonale doit aussi être couverte
		// La diagonale d'un carré de côté effectiveSize est effectiveSize * √2
		const diagonalRatio = (effectiveSize * Math.sqrt(2)) / Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);

		// Prendre le maximum des trois ratios pour garantir le remplissage complet
		let optimalScale = Math.max(widthRatio, heightRatio, diagonalRatio);

		// Ajouter une marge de sécurité de 10% pour éviter les bordures dues aux arrondis CSS
		optimalScale = optimalScale * 1.1;

		// S'assurer qu'on zoome au minimum à 1.3 pour bien remplir
		return Math.max(optimalScale, 1.3);
	}

	function applyUploadedImage(data, targetSlot = null) {
		if (!data) {
			return;
		}

		// Utiliser explicitement targetSlot si fourni, sinon state.currentSlot, sinon 'center'
		let slotKey = targetSlot !== null && targetSlot !== undefined ? targetSlot : (state.currentSlot || 'center');

		// Convertir en nombre si c'est un slot périphérique (1-12)
		if (slotKey !== 'center' && slotKey !== 'Centre') {
			const numKey = parseInt(slotKey, 10);
			if (!isNaN(numKey) && numKey >= 1 && numKey <= 12) {
				slotKey = numKey;
			}
		}

		// Debug: vérifier que le slotKey est correct
		console.log('applyUploadedImage - targetSlot:', targetSlot, 'slotKey:', slotKey, 'state.currentSlot:', state.currentSlot, 'data:', data);

		// Initialiser le slot s'il n'existe pas
		if (slotKey !== 'center' && !state.slots[slotKey]) {
			state.slots[slotKey] = {
				attachment_id: 0,
				image_url: '',
				image_url_display: '',
				x: 0,
				y: 0,
				scale: 1,
			};
			console.log('applyUploadedImage - Slot initialisé:', slotKey, state.slots[slotKey]);
		}

		const target = slotKey === 'center' ? state.center : state.slots[slotKey];

		if (!target) {
			console.error('applyUploadedImage - target introuvable pour slotKey:', slotKey, 'state.slots:', state.slots);
			return;
		}

		console.log('applyUploadedImage - target avant:', JSON.parse(JSON.stringify(target)));

		target.attachment_id = data.attachment_id || 0;
		// Pour les slots périphériques, utiliser thumbnail pour l'affichage (performance)
		// Pour le centre, utiliser full_url car l'image est plus grande
		if (slotKey === 'center') {
			target.image_url = data.full_url || data.url || '';
			target.image_url_display = data.full_url || data.url || '';
			// Calculer le scale optimal pour remplir le cercle sans blanc
			const imageUrl = target.image_url;
			if (imageUrl) {
				const img = new Image();
				img.onload = function () {
					const configurator = document.querySelector(selectors.configurator);
					// Récupérer la taille actuelle du centre
					let centerSize = target.size || 180;
					if (!target.size) {
						const centerSizeRange = configurator ? configurator.querySelector(selectors.centerSizeRange) : null;
						if (centerSizeRange) {
							centerSize = parseInt(centerSizeRange.value || 180, 10);
						}
					}

					// Calculer le zoom optimal pour remplir le cercle
					target.scale = calculateOptimalZoomForCircle(img.width, img.height, centerSize, DEFAULT_CENTER_INSET);
					target.x = 0;
					target.y = 0;

					// Appliquer les transformations après que le scale soit calculé
					setTimeout(() => {
						applyTransforms();
						updateSelectionUI();
						savePayload();
					}, 10);
				};
				img.onerror = function () {
					// En cas d'erreur, utiliser scale par défaut plus élevé pour remplir
					target.scale = 1.3;
					target.x = 0;
					target.y = 0;
					applyTransforms();
					updateSelectionUI();
					savePayload();
				};
				img.src = imageUrl;
				// Initialiser avec des valeurs par défaut, elles seront mises à jour dans onload
				target.x = 0;
				target.y = 0;
				target.scale = 1.3;

				// Définir la taille du centre si nécessaire (avant de retourner)
				const configurator = document.querySelector(selectors.configurator);
				const centerSizeRange = configurator ? configurator.querySelector(selectors.centerSizeRange) : null;
				const centerMax = state.centerMax || (centerSizeRange ? parseInt(centerSizeRange.max || `${target.size || 180}`, 10) : (target.size || 180));
				if (centerMax && !target.size) {
					// Par défaut, définir la taille à 50% du maximum
					const defaultSize = Math.round(centerMax * 0.5);
					target.size = Math.max(CENTER_MIN_SIZE, defaultSize);
					if (centerSizeRange) {
						centerSizeRange.value = target.size;

						// Mettre à jour l'affichage du pourcentage
						const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
						if (valueDisplay && centerMax > 0) {
							const percentage = Math.round((target.size / centerMax) * 100);
							valueDisplay.textContent = `${percentage}%`;
						}
					}
				}

				// Appliquer immédiatement pour afficher l'image, le scale sera optimisé dans onload
				applyTransforms();
				updateSelectionUI();
				savePayload();
				// Retourner ici car le scale optimal sera calculé et appliqué dans img.onload
				return;
			} else {
				// Si pas d'URL, initialiser avec valeurs par défaut
				target.x = 0;
				target.y = 0;
				target.scale = 1.3;
			}
		} else {
			// Slots périphériques : utiliser full_url pour l'affichage et le PDF (car le thumbnail peut ne pas exister)
			// Si full_url n'existe pas, utiliser url, mais vérifier que l'URL est valide
			const fullUrl = data.full_url || data.url || '';
			const thumbUrl = data.url || data.full_url || '';

			// Utiliser full_url pour les deux car c'est l'URL garantie d'exister
			target.image_url = fullUrl; // Pour le PDF/export
			target.image_url_display = fullUrl; // Utiliser full_url pour l'affichage aussi
			target.x = 0;
			target.y = 0;

			// Calculer le scale optimal pour remplir le rond périphérique
			const imageUrl = target.image_url;
			if (imageUrl) {
				const img = new Image();
				img.onload = function () {
					// Récupérer la taille effective du slot depuis le DOM
					const slotElement = document.querySelector(`[data-slot="${slotKey}"] .wc-pc13-slot-inner`);
					let slotSize = state.ringSize || 110; // Valeur par défaut

					if (slotElement) {
						// Utiliser la taille réelle du slot dans le DOM
						const rect = slotElement.getBoundingClientRect();
						slotSize = Math.min(rect.width, rect.height);
					}

					// Calculer le zoom optimal pour remplir le cercle périphérique
					// Utiliser un inset réduit pour les slots périphériques (pas d'ombre)
					target.scale = calculateOptimalZoomForCircle(img.width, img.height, slotSize, 2);
					target.x = 0;
					target.y = 0;

					// Appliquer les transformations après que le scale soit calculé
					setTimeout(() => {
						applyTransforms();
						updateSelectionUI();
						savePayload();
					}, 10);
				};
				img.onerror = function () {
					// En cas d'erreur, utiliser scale par défaut pour remplir
					target.scale = 1.3;
					target.x = 0;
					target.y = 0;
					applyTransforms();
					updateSelectionUI();
					savePayload();
				};
				img.src = imageUrl;
				// Initialiser avec des valeurs par défaut, elles seront mises à jour dans onload
				target.x = 0;
				target.y = 0;
				target.scale = 1.3;
			} else {
				// Si pas d'URL, initialiser avec valeurs par défaut
				target.x = 0;
				target.y = 0;
				target.scale = 1.3;
			}

			console.log('applyUploadedImage - Slot périphérique mis à jour:', slotKey, 'image_url:', target.image_url, 'image_url_display:', target.image_url_display, 'full_url:', data.full_url, 'url:', data.url);
			console.log('applyUploadedImage - state.slots après mise à jour:', JSON.parse(JSON.stringify(state.slots[slotKey])));

			// Appliquer immédiatement pour afficher l'image, le scale sera optimisé dans img.onload
			applyTransforms();
			updateSelectionUI();
			savePayload();
			// Retourner ici car le scale optimal sera calculé et appliqué dans img.onload
			return;
		}

		console.log('applyUploadedImage - image_url défini:', target.image_url, 'full_url:', data.full_url, 'url:', data.url);

		console.log('applyUploadedImage - target après:', JSON.parse(JSON.stringify(target)));

		if (slotKey === 'center') {
			const configurator = document.querySelector(selectors.configurator);
			const centerSizeRange = configurator ? configurator.querySelector(selectors.centerSizeRange) : null;
			const centerMax = state.centerMax || (centerSizeRange ? parseInt(centerSizeRange.max || `${state.center.size}`, 10) : state.center.size);
			if (centerMax) {
				// Par défaut, définir la taille à 50% du maximum
				const defaultSize = Math.round(centerMax * 0.5);
				target.size = Math.max(CENTER_MIN_SIZE, defaultSize);
				if (centerSizeRange) {
					centerSizeRange.value = target.size;

					// Mettre à jour l'affichage du pourcentage
					const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
					if (valueDisplay && centerMax > 0) {
						const percentage = Math.round((target.size / centerMax) * 100);
						valueDisplay.textContent = `${percentage}%`;
					}
				}
			}
		}

		// Forcer la mise à jour de l'affichage pour le slot spécifique
		console.log('applyUploadedImage - Appel de applyTransforms() pour slotKey:', slotKey);
		applyTransforms();
		updateSelectionUI();
		savePayload();

		// Forcer un rafraîchissement visuel supplémentaire pour s'assurer que l'image s'affiche
		if (slotKey !== 'center') {
			// Utiliser requestAnimationFrame pour s'assurer que le DOM est à jour
			requestAnimationFrame(() => {
				setTimeout(() => {
					const configurator = document.querySelector(selectors.configurator);
					if (configurator && state.slots[slotKey]) {
						const slotKeyStr = String(slotKey);
						const slot = configurator.querySelector(`${selectors.slot}[data-slot="${slotKeyStr}"] ${selectors.slotImage}`);
						const slotInner = configurator.querySelector(`${selectors.slot}[data-slot="${slotKeyStr}"] .wc-pc13-slot-inner`);
						const slotState = state.slots[slotKey];

						if (slot && slotState && slotState.image_url) {
							const displayUrl = (slotState.image_url_display || slotState.image_url).trim();
							if (displayUrl) {
								// Forcer l'affichage de l'image avec tous les styles nécessaires
								slot.style.setProperty('background-image', `url("${displayUrl}")`, 'important');
								slot.style.setProperty('background-repeat', 'no-repeat', 'important');
								slot.style.setProperty('background-size', `${(slotState.scale || 1) * 100}%`, 'important');
								slot.style.setProperty('background-position', `${50 + (slotState.x || 0)}% ${50 + (slotState.y || 0)}%`, 'important');
								slot.style.setProperty('opacity', '1', 'important');
								slot.style.setProperty('visibility', 'visible', 'important');
								slot.style.setProperty('display', 'block', 'important');
								slot.classList.remove('empty');
								if (slotInner) {
									slotInner.classList.add('has-image');
								}
								console.log('applyUploadedImage - Image forcée sur slot:', slotKey, 'URL:', displayUrl, 'slot trouvé:', !!slot, 'styles appliqués');

								// Vérifier que l'image est bien chargée
								const testImg = new Image();
								testImg.onload = () => {
									console.log('applyUploadedImage - Image chargée avec succès:', displayUrl);
								};
								testImg.onerror = () => {
									console.error('applyUploadedImage - Erreur de chargement de l\'image:', displayUrl);
								};
								testImg.src = displayUrl;
							} else {
								console.error('applyUploadedImage - URL vide pour slot:', slotKey);
							}
						} else {
							console.error('applyUploadedImage - Slot ou image_url introuvable:', slotKey, 'slot:', !!slot, 'slotState:', !!slotState, 'image_url:', slotState?.image_url);
						}
					}
				}, 200);
			});
		}
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

		// Déterminer le slot cible en priorité : uploadTargetSlot > dataset.targetSlot > state.currentSlot > 'center'
		// IMPORTANT: Sauvegarder la valeur AVANT de nettoyer
		let slotKey = uploadTargetSlot;
		if (!slotKey && inputEl && inputEl.dataset && inputEl.dataset.targetSlot) {
			// Convertir en nombre si c'est un nombre
			const datasetSlot = inputEl.dataset.targetSlot;
			slotKey = (datasetSlot === 'center' || datasetSlot === 'Centre') ? 'center' : (parseInt(datasetSlot, 10) || datasetSlot);
		}
		if (!slotKey) {
			slotKey = state.currentSlot;
		}
		if (!slotKey) {
			slotKey = 'center';
		}

		const configurator = document.querySelector(selectors.configurator);

		// Debug: vérifier que le slotKey est bien défini
		console.log('processFile - slotKey:', slotKey, 'uploadTargetSlot:', uploadTargetSlot, 'state.currentSlot:', state.currentSlot, 'inputEl.dataset.targetSlot:', inputEl && inputEl.dataset ? inputEl.dataset.targetSlot : 'N/A');

		// Nettoyer le targetSlot pour les prochains uploads APRÈS avoir sauvegardé la valeur
		// Convertir savedSlotKey en nombre si c'est un nombre valide (pour les slots périphériques)
		let savedSlotKey = slotKey;
		if (typeof slotKey === 'string' && slotKey !== 'center' && !isNaN(parseInt(slotKey, 10))) {
			savedSlotKey = parseInt(slotKey, 10);
		}

		if (inputEl && inputEl.dataset) {
			delete inputEl.dataset.targetSlot;
		}
		uploadTargetSlot = null;

		const slotElement = configurator
			? (savedSlotKey === 'center'
				? configurator.querySelector(selectors.center)
				: configurator.querySelector(`${selectors.slot}[data-slot="${savedSlotKey}"]`))
			: null;
		if (slotElement) {
			slotElement.classList.add('wc-pc13-slot-loading');
		}

		// Afficher le loader
		let loadingButton = null;
		let originalText = '';
		if (savedSlotKey === 'center') {
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

		// Debug avant uploadFile
		if (window.WCPC13_DEBUG) {
			console.log('processFile - Avant uploadFile, savedSlotKey:', savedSlotKey, 'file:', file.name);
		}

		// Pour les slots périphériques, redimensionner l'image côté client avant l'upload
		const isPeripheral = savedSlotKey !== 'center' && savedSlotKey !== 'Centre' &&
			typeof savedSlotKey === 'number' && savedSlotKey >= 1 && savedSlotKey <= 12;

		let uploadPromise;
		if (isPeripheral) {
			// Redimensionner l'image côté client à 2000px max pour alléger le serveur
			uploadPromise = resizeImageForPeripheral(file, 2000, 0.9)
				.then((resizedBlob) => {
					// Créer un nouveau File à partir du blob pour l'upload
					const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
					if (window.WCPC13_DEBUG) {
						console.log('processFile - Image redimensionnée côté client:', {
							originalSize: file.size,
							resizedSize: resizedBlob.size,
							reduction: Math.round((1 - resizedBlob.size / file.size) * 100) + '%'
						});
					}
					return uploadFile(savedSlotKey, resizedFile);
				});
		} else {
			// Pour le centre, uploader l'image originale
			uploadPromise = uploadFile(savedSlotKey, file);
		}

		uploadPromise
			.then((response) => {
				// Debug avant applyUploadedImage
				if (window.WCPC13_DEBUG) {
					console.log('processFile - Réponse uploadFile reçue, savedSlotKey:', savedSlotKey, 'response:', response);
				}
				// S'assurer que le slotKey est bien passé à applyUploadedImage
				applyUploadedImage(response, savedSlotKey);
			})
			.catch((error) => {
				console.error('Erreur uploadFile:', error);
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

		// Debug: vérifier les valeurs avant processFile
		if (window.WCPC13_DEBUG) {
			console.log('handleFileChange - uploadTargetSlot:', uploadTargetSlot, 'state.currentSlot:', state.currentSlot, 'dataset.targetSlot:', event.target.dataset?.targetSlot);
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
			current.scale = 1.3;
			applyTransforms();
			updateSelectionUI();
			savePayload();
		});
	}

	function handleZoomChange(event) {
		const current = getCurrentSlotState();
		if (!current) {
			console.error('handleZoomChange - current slot state introuvable, state.currentSlot:', state.currentSlot);
			return;
		}
		const newScale = parseFloat(event.target.value);
		if (isNaN(newScale)) {
			console.warn('handleZoomChange - valeur de zoom invalide (NaN):', event.target.value);
			return;
		}
		// Mettre à jour le scale dans le state
		current.scale = newScale;
		// Clamper les valeurs (cela met aussi à jour current.scale, current.x, current.y)
		const clamped = clampTransformValues(current);
		// S'assurer que le scale est bien sauvegardé après le clamp
		current.scale = clamped.scale;
		current.x = clamped.x;
		current.y = clamped.y;
		console.log('handleZoomChange - Slot:', state.currentSlot, 'nouveau scale:', newScale, 'clamped scale:', clamped.scale, 'current.scale:', current.scale);
		// Forcer la mise à jour de l'affichage
		applyTransforms();
		updateSelectionUI();
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
		if (event && event.stopPropagation) event.stopPropagation();
		state.ringSize = parseInt(event.target.value, 10);
		// Forcer la synchronisation de la position des chiffres pour qu'ils restent centrés sur les photos
		updateRingDimensions(true);
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
		const clamped = Math.max(CENTER_MIN_SIZE, Math.min(maxSize, value));
		state.center.size = clamped;

		// Mettre à jour l'affichage du pourcentage
		const valueDisplay = document.getElementById('wc-pc13-center-size-value');
		if (valueDisplay && maxSize > 0) {
			const percentage = Math.round((clamped / maxSize) * 100);
			valueDisplay.textContent = `${percentage}%`;
		}

		applyTransforms();
		savePayload();
	}

	function handleNumbersToggle(event) {
		// S'assurer que l'événement vient bien du checkbox et non d'une propagation
		// Ne traiter que si c'est un clic direct sur la checkbox ou si c'est un événement change depuis la checkbox
		if (event.type === 'click' && (event.target.type !== 'checkbox' || event.target.id !== 'wc-pc13-show-numbers')) {
			// Si c'est un clic sur le span, laisser le comportement par défaut du label
			if (event.target.tagName === 'SPAN' && event.target.closest('.wc-pc13-toggle')) {
				// Le label gérera automatiquement le clic sur le checkbox
				return;
			}
			// Pour tout autre élément, empêcher la propagation
			event.stopPropagation();
			return;
		}

		// Pour l'événement change, s'assurer que c'est bien la bonne checkbox
		if (event.type === 'change' && (event.target.type !== 'checkbox' || event.target.id !== 'wc-pc13-show-numbers')) {
			return;
		}

		state.showNumbers = !!event.target.checked;

		const configurator = document.querySelector(selectors.configurator);
		const numbersFields = configurator ? configurator.querySelector(selectors.numbersFields) : null;

		// Afficher ou masquer les champs des options des chiffres
		if (numbersFields) {
			if (state.showNumbers) {
				numbersFields.style.display = 'flex';
				numbersFields.classList.add('is-active');
			} else {
				numbersFields.style.display = 'none';
				numbersFields.classList.remove('is-active');
			}
		}

		// Si l'option est activée et que la distance n'est pas encore définie (ou est à 0), définir à 77% par défaut
		if (state.showNumbers && (!state.numbers.distance || state.numbers.distance === 0)) {
			const numbersDistanceInput = configurator ? configurator.querySelector(selectors.numbersDistance) : null;
			if (numbersDistanceInput) {
				const maxValue = parseInt(numbersDistanceInput.max, 10);
				if (maxValue > 0) {
					const defaultDistance = Math.round(maxValue * 0.77); // 77% du max
					state.numbers.distance = defaultDistance;
					numbersDistanceInput.value = defaultDistance;

					// Mettre à jour l'affichage du pourcentage
					const valueDisplay = configurator.querySelector('#wc-pc13-number-distance-value');
					if (valueDisplay) {
						valueDisplay.textContent = '77%';
					}
				}
			}
		}

		updateSelectionUI();
		applyTransforms();
		savePayload();
	}

	function handleNumbersColorChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		const value = event.target.value;
		state.numbers.color = value || '#222222';
		applyTransforms();
		savePayload();
	}

	function handleNumbersSizeChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		const value = parseInt(event.target.value, 10);
		if (Number.isNaN(value)) {
			return;
		}
		state.numbers.size = Math.max(12, Math.min(150, value));
		applyTransforms();
		savePayload();
	}


	function handleSlotBorderEnabledChange(event) {
		if (event && event.stopPropagation) event.stopPropagation();
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
		if (event && event.stopPropagation) event.stopPropagation();
		state.slotBorder.color = event.target.value || '#000000';
		applyTransforms();
		savePayload();
	}

	function handleSlotBorderWidthChange(event) {
		if (event && event.stopPropagation) event.stopPropagation();
		const value = parseInt(event.target.value, 10);
		if (Number.isNaN(value)) {
			return;
		}
		state.slotBorder.width = Math.max(1, Math.min(10, value));
		applyTransforms();
		savePayload();
	}

	function handleSlotShadowEnabledChange(event) {
		if (event && event.stopPropagation) event.stopPropagation();
		state.slotShadow.enabled = !!event.target.checked;
		applyTransforms();
		savePayload();
	}

	function handleNumberShadowEnabledChange(event) {
		if (!state.numbers.shadow) {
			state.numbers.shadow = { enabled: false, intensity: 5 };
		}
		state.numbers.shadow.enabled = !!event.target.checked;

		const configurator = document.querySelector(selectors.configurator);
		const shadowFields = configurator ? configurator.querySelector(selectors.numberShadowFields) : null;
		const shadowIntensity = configurator ? configurator.querySelector(selectors.numberShadowIntensity) : null;

		if (shadowFields) {
			shadowFields.style.display = state.numbers.shadow.enabled ? 'block' : 'none';
		}

		if (shadowIntensity) {
			shadowIntensity.disabled = !state.numbers.shadow.enabled;
			if (!state.numbers.shadow.intensity) {
				state.numbers.shadow.intensity = 5;
				shadowIntensity.value = 5;
			}
		}

		updateNumbersOverlay(configurator, state.currentRingRadius);
		applyTransforms();
		savePayload();
	}

	function handleNumberShadowIntensityChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		if (!event || !event.target) {
			return;
		}

		// S'assurer que c'est bien le slider de l'ombre
		if (event.target.id !== 'wc-pc13-number-shadow-intensity') {
			return;
		}

		if (!state.numbers.shadow) {
			state.numbers.shadow = { enabled: true, intensity: 5 };
		}
		const value = parseInt(event.target.value, 10);
		if (!Number.isNaN(value)) {
			// Mettre à jour l'ombre, pas le glow
			state.numbers.shadow.intensity = Math.max(0, Math.min(20, value));
		}
		const configurator = document.querySelector(selectors.configurator);
		updateNumbersOverlay(configurator, state.currentRingRadius);
		applyTransforms();
		savePayload();
	}

	function handleNumberGlowEnabledChange(event) {
		if (!state.numbers.glow) {
			state.numbers.glow = { enabled: false, intensity: 10, color: '#ffffff' };
		}
		state.numbers.glow.enabled = !!event.target.checked;

		const configurator = document.querySelector(selectors.configurator);
		const glowFields = configurator ? configurator.querySelector(selectors.numberGlowFields) : null;
		const glowIntensity = configurator ? configurator.querySelector(selectors.numberGlowIntensity) : null;
		const glowColor = configurator ? configurator.querySelector(selectors.numberGlowColor) : null;

		if (glowFields) {
			glowFields.style.display = state.numbers.glow.enabled ? 'block' : 'none';
		}

		if (glowIntensity) {
			glowIntensity.disabled = !state.numbers.glow.enabled;
			if (!state.numbers.glow.intensity) {
				state.numbers.glow.intensity = 10;
				glowIntensity.value = 10;
			}
		}

		if (glowColor) {
			// Toujours initialiser la couleur si elle n'existe pas (blanc par défaut)
			if (!state.numbers.glow.color) {
				state.numbers.glow.color = '#ffffff';
			}
			// S'assurer que la valeur du sélecteur correspond à la couleur du state
			if (glowColor.value !== state.numbers.glow.color) {
				glowColor.value = state.numbers.glow.color;
			}
			// Le sélecteur de couleur peut être utilisé même si le glow n'est pas activé (pour prévisualisation)
			// Mais on le désactive quand le glow n'est pas activé pour cohérence avec l'intensité
			glowColor.disabled = !state.numbers.glow.enabled;
		}

		updateNumbersOverlay(configurator, state.currentRingRadius);
		applyTransforms();
		savePayload();
	}

	function handleNumberGlowColorChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		if (event && event.stopPropagation) {
			event.stopPropagation();
		}

		if (!event || !event.target) {
			return;
		}

		// S'assurer que c'est bien le sélecteur de couleur du glow
		if (event.target.id !== 'wc-pc13-number-glow-color') {
			return;
		}

		if (!state.numbers.glow) {
			state.numbers.glow = { enabled: false, intensity: 10, color: '#ffffff' };
		}
		const color = event.target.value || '#ffffff';
		state.numbers.glow.color = color;

		const configurator = document.querySelector(selectors.configurator);
		if (configurator) {
			updateNumbersOverlay(configurator, state.currentRingRadius);
			applyTransforms();
			savePayload();
		}
	}

	function handleNumberGlowIntensityChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		if (!event || !event.target) {
			return;
		}

		// S'assurer que c'est bien le slider du glow
		if (event.target.id !== 'wc-pc13-number-glow-intensity') {
			return;
		}

		if (!state.numbers.glow) {
			state.numbers.glow = { enabled: true, intensity: 10, color: '#ffffff' };
		}

		// Récupérer la valeur du slider
		const slider = event.target;
		const min = parseInt(slider.min || 1, 10);
		const max = parseInt(slider.max || 30, 10);
		let value = parseInt(slider.value, 10);

		// Si le slider a min=0, convertir 0 en 1 (intensité minimale visible)
		if (min === 0 && value === 0) {
			value = 1;
		}

		// S'assurer que la valeur est dans les limites (1-30)
		if (!Number.isNaN(value)) {
			state.numbers.glow.intensity = Math.max(1, Math.min(30, value));
			// Mettre à jour la valeur du slider pour refléter la valeur corrigée
			slider.value = state.numbers.glow.intensity;
		}

		const configurator = document.querySelector(selectors.configurator);
		updateNumbersOverlay(configurator, state.currentRingRadius);
		applyTransforms();
		savePayload();
	}

	function handleNumbersDistanceChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		const value = parseInt(event.target.value, 10);
		if (Number.isNaN(value)) {
			return;
		}
		const maxAttr = parseInt(event.target.getAttribute('max'), 10);
		// Le slider va de 0 (au centre) à max (collé au bord du cadran)
		const maxDistance = Number.isNaN(maxAttr) ? 350 : maxAttr; // Fallback à 350 si max non défini
		const clamped = Math.max(0, Math.min(maxDistance, value));
		state.numbers.distance = clamped;

		// Mettre à jour l'affichage de la valeur en pourcentage
		const valueDisplay = document.getElementById('wc-pc13-number-distance-value');
		if (valueDisplay && maxDistance > 0) {
			const percentage = Math.round((clamped / maxDistance) * 100);
			valueDisplay.textContent = `${percentage}%`;
		}

		applyTransforms();
		updateSelectionUI();
		savePayload();
	}

	function handleNumberTypeChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		state.numbers.numberType = event.target.value || 'arabic';
		applyTransforms();
		savePayload();
	}

	function handleIntermediatePointsChange(event) {
		// Empêcher la propagation vers le label parent pour éviter de déclencher le toggle
		event.stopPropagation();

		state.numbers.intermediatePoints = event.target.value || 'without';
		applyTransforms();
		savePayload();
	}

	/**
	 * Crée un overlay de loading élégant avec animation.
	 */
	function createLoadingOverlay() {
		const overlay = document.createElement('div');
		overlay.className = 'wc-pc13-loading-overlay';
		overlay.innerHTML = `
			<div class="wc-pc13-loading-content">
				<div class="wc-pc13-loading-spinner">
					<svg viewBox="0 0 50 50" class="wc-pc13-spinner-svg">
						<circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
							<animate attributeName="stroke-dasharray" dur="1.5s" repeatCount="indefinite" values="1,150;90,150;90,150"/>
							<animate attributeName="stroke-dashoffset" dur="1.5s" repeatCount="indefinite" values="0;-35;-125"/>
						</circle>
					</svg>
				</div>
				<div class="wc-pc13-loading-message">Préparation en cours...</div>
				<div class="wc-pc13-loading-progress">
					<div class="wc-pc13-loading-progress-bar"></div>
				</div>
				<div class="wc-pc13-loading-step">Étape 1/3</div>
			</div>
		`;

		// Ajouter les styles inline
		const style = document.createElement('style');
		style.textContent = `
			.wc-pc13-loading-overlay {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.8);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 999999;
				opacity: 1;
				transition: opacity 0.3s ease;
			}
			.wc-pc13-loading-overlay.is-hiding {
				opacity: 0;
			}
			.wc-pc13-loading-content {
				text-align: center;
				color: #fff;
				padding: 40px;
				background: rgba(255, 255, 255, 0.1);
				border-radius: 20px;
				border: 1px solid rgba(255, 255, 255, 0.2);
				min-width: 300px;
			}
			.wc-pc13-loading-spinner {
				width: 80px;
				height: 80px;
				margin: 0 auto 24px;
			}
			.wc-pc13-spinner-svg {
				width: 100%;
				height: 100%;
				color: #10b981;
				animation: wc-pc13-rotate 2s linear infinite;
			}
			@keyframes wc-pc13-rotate {
				100% { transform: rotate(360deg); }
			}
			.wc-pc13-loading-message {
				font-size: 18px;
				font-weight: 500;
				margin-bottom: 20px;
				min-height: 27px;
			}
			.wc-pc13-loading-progress {
				width: 100%;
				height: 6px;
				background: rgba(255, 255, 255, 0.2);
				border-radius: 3px;
				overflow: hidden;
				margin-bottom: 12px;
			}
			.wc-pc13-loading-progress-bar {
				height: 100%;
				background: linear-gradient(90deg, #10b981, #3b82f6);
				border-radius: 3px;
				width: 33%;
				transition: width 0.5s ease;
			}
			.wc-pc13-loading-step {
				font-size: 14px;
				color: rgba(255, 255, 255, 0.7);
			}
		`;
		overlay.appendChild(style);
		return overlay;
	}

	/**
	 * Met à jour le message et la progression du loading overlay.
	 */
	function updateLoadingMessage(overlay, message, step, totalSteps) {
		if (!overlay) return;
		const messageEl = overlay.querySelector('.wc-pc13-loading-message');
		const progressBar = overlay.querySelector('.wc-pc13-loading-progress-bar');
		const stepEl = overlay.querySelector('.wc-pc13-loading-step');

		if (messageEl) messageEl.textContent = message;
		if (progressBar) progressBar.style.width = `${(step / totalSteps) * 100}%`;
		if (stepEl) stepEl.textContent = `Étape ${step}/${totalSteps}`;
	}

	/**
	 * Initialise la fonctionnalité AR (réalité augmentée).
	 */
	let arStream = null;
	let arDragState = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };

	function initAR() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) return;

		const arBtn = configurator.querySelector(selectors.arBtn);
		const arModal = document.querySelector(selectors.arModal);
		if (!arBtn || !arModal) return;

		const arModalClose = arModal.querySelector(selectors.arModalClose);
		const arVideo = arModal.querySelector(selectors.arVideo);
		const arClockOverlay = arModal.querySelector(selectors.arClockOverlay);
		const arClockImage = arModal.querySelector(selectors.arClockImage);
		const arSizeInput = arModal.querySelector(selectors.arSize);
		const arCaptureBtn = arModal.querySelector(selectors.arCapture);
		const arResetBtn = arModal.querySelector(selectors.arReset);
		const arError = arModal.querySelector(selectors.arError);

		// Ajouter les styles AR
		const arStyles = document.createElement('style');
		arStyles.textContent = `
			.wc-pc13-ar-modal {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.95);
				z-index: 999999;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			.wc-pc13-ar-modal-content {
				width: 100%;
				max-width: 800px;
				max-height: 100vh;
				background: #1a1a2e;
				border-radius: 12px;
				overflow: hidden;
				display: flex;
				flex-direction: column;
			}
			.wc-pc13-ar-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 16px 20px;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				color: #fff;
			}
			.wc-pc13-ar-header h3 {
				margin: 0;
				font-size: 18px;
			}
			.wc-pc13-ar-modal-close {
				background: none;
				border: none;
				color: #fff;
				font-size: 28px;
				cursor: pointer;
				line-height: 1;
				padding: 0;
			}
			.wc-pc13-ar-body {
				flex: 1;
				display: flex;
				flex-direction: column;
				padding: 16px;
			}
			.wc-pc13-ar-instructions {
				text-align: center;
				color: #a0a0a0;
				margin-bottom: 12px;
			}
			.wc-pc13-ar-container {
				position: relative;
				width: 100%;
				aspect-ratio: 4/3;
				background: #000;
				border-radius: 8px;
				overflow: hidden;
			}
			#wc-pc13-ar-video {
				width: 100%;
				height: 100%;
				object-fit: cover;
			}
			.wc-pc13-ar-clock-overlay {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				cursor: grab;
				touch-action: none;
				transition: box-shadow 0.2s;
			}
			.wc-pc13-ar-clock-overlay:active {
				cursor: grabbing;
			}
			.wc-pc13-ar-clock-overlay img {
				width: 200px;
				height: 200px;
				border-radius: 50%;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
				pointer-events: none;
			}
			.wc-pc13-ar-controls {
				margin-top: 16px;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.wc-pc13-ar-size-control {
				color: #fff;
			}
			.wc-pc13-ar-size-control label {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.wc-pc13-ar-size-control input[type="range"] {
				width: 100%;
			}
			.wc-pc13-ar-actions {
				display: flex;
				gap: 10px;
				justify-content: center;
			}
			.wc-pc13-ar-error {
				background: rgba(255, 0, 0, 0.1);
				border: 1px solid #ff4444;
				color: #ff6666;
				padding: 16px;
				border-radius: 8px;
				text-align: center;
			}
		`;
		document.head.appendChild(arStyles);

		// Ouvrir le modal AR
		arBtn.addEventListener('click', async () => {
			// Générer l'aperçu de l'horloge
			try {
				const canvas = await capturePreview(1, { printMode: false, skipLivePreviewUpdate: true });
				const dataUrl = canvas.toDataURL('image/png');
				arClockImage.src = dataUrl;
				arClockImage.style.width = `${arSizeInput.value}px`;
				arClockImage.style.height = `${arSizeInput.value}px`;
			} catch (error) {
				console.error('Erreur lors de la capture pour AR:', error);
			}

			arModal.style.display = 'flex';
			arError.style.display = 'none';

			// Réinitialiser la position
			arClockOverlay.style.top = '50%';
			arClockOverlay.style.left = '50%';
			arClockOverlay.style.transform = 'translate(-50%, -50%)';
			arDragState = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };

			// Démarrer la caméra
			try {
				arStream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
				});
				arVideo.srcObject = arStream;
			} catch (err) {
				console.error('Erreur caméra:', err);
				arError.style.display = 'block';
			}
		});

		// Fermer le modal AR
		const closeAR = () => {
			arModal.style.display = 'none';
			if (arStream) {
				arStream.getTracks().forEach(track => track.stop());
				arStream = null;
			}
		};

		arModalClose.addEventListener('click', closeAR);
		arModal.addEventListener('click', (e) => {
			if (e.target === arModal) closeAR();
		});

		// Changer la taille de l'horloge
		arSizeInput.addEventListener('input', () => {
			const size = arSizeInput.value;
			arClockImage.style.width = `${size}px`;
			arClockImage.style.height = `${size}px`;
		});

		// Drag & drop pour positionner l'horloge
		const startDrag = (e) => {
			arDragState.active = true;
			const rect = arClockOverlay.getBoundingClientRect();
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			arDragState.startX = clientX - rect.left - rect.width / 2;
			arDragState.startY = clientY - rect.top - rect.height / 2;
		};

		const moveDrag = (e) => {
			if (!arDragState.active) return;
			e.preventDefault();
			const container = arClockOverlay.parentElement;
			const containerRect = container.getBoundingClientRect();
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;

			let x = clientX - containerRect.left - arDragState.startX;
			let y = clientY - containerRect.top - arDragState.startY;

			// Limiter aux bords
			const clockSize = parseInt(arSizeInput.value);
			x = Math.max(clockSize / 2, Math.min(containerRect.width - clockSize / 2, x));
			y = Math.max(clockSize / 2, Math.min(containerRect.height - clockSize / 2, y));

			arClockOverlay.style.left = `${x}px`;
			arClockOverlay.style.top = `${y}px`;
			arClockOverlay.style.transform = 'translate(-50%, -50%)';
		};

		const endDrag = () => {
			arDragState.active = false;
		};

		arClockOverlay.addEventListener('mousedown', startDrag);
		arClockOverlay.addEventListener('touchstart', startDrag, { passive: false });
		document.addEventListener('mousemove', moveDrag);
		document.addEventListener('touchmove', moveDrag, { passive: false });
		document.addEventListener('mouseup', endDrag);
		document.addEventListener('touchend', endDrag);

		// Réinitialiser la position
		arResetBtn.addEventListener('click', () => {
			arClockOverlay.style.top = '50%';
			arClockOverlay.style.left = '50%';
			arClockOverlay.style.transform = 'translate(-50%, -50%)';
			arSizeInput.value = 200;
			arClockImage.style.width = '200px';
			arClockImage.style.height = '200px';
		});

		// Capturer une photo
		arCaptureBtn.addEventListener('click', () => {
			const container = arClockOverlay.parentElement;
			const canvas = document.createElement('canvas');
			canvas.width = arVideo.videoWidth;
			canvas.height = arVideo.videoHeight;
			const ctx = canvas.getContext('2d');

			// Dessiner la vidéo
			ctx.drawImage(arVideo, 0, 0);

			// Calculer la position de l'horloge sur le canvas
			const containerRect = container.getBoundingClientRect();
			const overlayRect = arClockOverlay.getBoundingClientRect();
			const scaleX = arVideo.videoWidth / containerRect.width;
			const scaleY = arVideo.videoHeight / containerRect.height;

			const clockX = (overlayRect.left - containerRect.left + overlayRect.width / 2) * scaleX;
			const clockY = (overlayRect.top - containerRect.top + overlayRect.height / 2) * scaleY;
			const clockSize = parseInt(arSizeInput.value) * scaleX;

			// Dessiner l'horloge
			const clockImg = new Image();
			clockImg.onload = () => {
				ctx.save();
				ctx.beginPath();
				ctx.arc(clockX, clockY, clockSize / 2, 0, Math.PI * 2);
				ctx.closePath();
				ctx.clip();
				ctx.drawImage(clockImg, clockX - clockSize / 2, clockY - clockSize / 2, clockSize, clockSize);
				ctx.restore();

				// Télécharger
				const link = document.createElement('a');
				link.download = `horloge-ar-${Date.now()}.jpg`;
				link.href = canvas.toDataURL('image/jpeg', 0.9);
				link.click();
			};
			clockImg.src = arClockImage.src;
		});
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

			// Créer l'overlay de loading élégant
			const loadingOverlay = createLoadingOverlay();
			document.body.appendChild(loadingOverlay);

			try {
				savePayload();

				// Étape 1: Génération de l'aperçu
				updateLoadingMessage(loadingOverlay, 'Préparation de l\'aperçu...', 1, 3);
				const [previewData, thumbnailDataUrl] = await Promise.all([
					uploadPreviewForCart(),
					generateThumbnail(1, 0.75)
				]);

				// Étape 2: Préparation du PDF HD (asynchrone)
				updateLoadingMessage(loadingOverlay, 'Préparation du visuel HD...', 2, 3);
				let pdfData = null;
				// Ne pas attendre la génération du PDF - elle sera faite en arrière-plan

				// Étape 3: Ajout au panier
				updateLoadingMessage(loadingOverlay, 'Ajout au panier...', 3, 3);

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
					formData.append('wc_pc13_preview_id', previewIdInput.value);
					formData.append('preview_id', previewIdInput.value);
				}
				if (previewUrlInput && previewUrlInput.value) {
					formData.append('wc_pc13_preview_url', previewUrlInput.value);
					formData.append('preview_url', previewUrlInput.value);
				}
				// Ajouter le PDF HD s'il a été généré
				if (pdfData && pdfData.attachment_id) {
					formData.append('wc_pc13_pdf_id', pdfData.attachment_id);
					formData.append('pdf_id', pdfData.attachment_id);
					if (pdfIdInput) pdfIdInput.value = pdfData.attachment_id;
				}
				if (pdfData && pdfData.url) {
					formData.append('wc_pc13_pdf_url', pdfData.url);
					formData.append('pdf_url', pdfData.url);
					if (pdfUrlInput) pdfUrlInput.value = pdfData.url;
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

				// Retirer l'overlay
				loadingOverlay.classList.add('is-hiding');
				setTimeout(() => loadingOverlay.remove(), 300);

				// Utiliser la vignette générée ou l'URL de prévisualisation
				const notificationData = {
					...data.data,
					preview_url: thumbnailDataUrl || data.data.preview_url || ''
				};

				// Afficher la notification
				showAddToCartNotification(notificationData);

				// Générer le PDF HD en arrière-plan (non-bloquant)
				setTimeout(() => {
					uploadPdfForCart().then(pdfResult => {
						console.log('PDF généré avec succès en arrière-plan:', pdfResult);
						// Mettre à jour l'interface si nécessaire
						updateCartFragments();
					}).catch(pdfError => {
						console.warn('Génération PDF en arrière-plan échouée:', pdfError);
						// Assurer que l'état du bouton PDF est remis à jour même en cas d'erreur
						updateCartFragments();
					});
				}, 1000); // Délai d'1 seconde pour ne pas surcharger

				// Réactiver le bouton
				customBtn.disabled = false;
				customBtn.classList.remove('is-loading');

				// Mettre à jour le panier WooCommerce avec les fragments
				if (data.data.fragments && typeof jQuery !== 'undefined') {
					// Appliquer les fragments pour mettre à jour le mini panier
					jQuery.each(data.data.fragments, function (selector, html) {
						jQuery(selector).replaceWith(html);
					});

					// Déclencher l'événement WooCommerce pour mettre à jour le panier
					jQuery(document.body).trigger('added_to_cart', [
						data.data.fragments || {},
						data.data.cart_hash || '',
						jQuery(customBtn)
					]);

					// Déclencher aussi l'événement wc_fragment_refresh pour forcer la mise à jour
					jQuery(document.body).trigger('wc_fragment_refresh');

					// Réorganiser les éléments du mini-cart - DESACTIVE par demande utilisateur
					// setTimeout(reorganizeMiniCart, 100);
				}

				// Mettre à jour le compteur du panier si présent
				if (data.data.cart_count !== undefined) {
					const cartCountElements = document.querySelectorAll('.cart-contents-count, .wc-block-mini-cart__badge, .cart-count');
					cartCountElements.forEach((el) => {
						el.textContent = data.data.cart_count;
					});
				}

			} catch (error) {
				console.error(error);
				// Retirer l'overlay de loading
				if (loadingOverlay && loadingOverlay.parentNode) {
					loadingOverlay.classList.add('is-hiding');
					setTimeout(() => loadingOverlay.remove(), 300);
				}
				window.alert(error?.message || WCPC13.labels.preview_error || 'Erreur lors de l\'ajout au panier');
				customBtn.disabled = false;
				customBtn.classList.remove('is-loading');
			}
		});
	}

	/* Function désactivée par demande utilisateur car elle modifie le mini-cart de manière non souhaitée
	function reorganizeMiniCart() {
		// Trouver tous les éléments li du mini-cart
		const miniCartItems = document.querySelectorAll('.woocommerce-mini-cart-item');

		miniCartItems.forEach((item, index) => {
			// Chercher le div.ux-mini-cart-qty dans cet item
			const qtyDiv = item.querySelector('.ux-mini-cart-qty');
			if (qtyDiv) {
				// Chercher le span.quantity dans ce div
				const quantitySpan = qtyDiv.querySelector('span.quantity');
				if (quantitySpan) {
					// Chercher le lien produit dans .product-name a ou directement dans le li
					const productLink = item.querySelector('.product-name a') || item.querySelector('a');
					if (productLink) {
						// Vérifier si le span.quantity n'est pas déjà dans le bon endroit
						const existingQuantity = productLink.querySelector('span.quantity');
						if (!existingQuantity) {
							// Créer une copie du span.quantity pour éviter les conflits de style
							const quantityClone = quantitySpan.cloneNode(true);
							quantityClone.className = 'quantity wc-pc13-quantity-clone';

							// Insérer après le premier enfant textuel ou au début si pas d'enfants
							const firstChild = productLink.firstChild;
							if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
								// Si le premier enfant est un nœud texte, insérer après
								productLink.insertBefore(quantityClone, firstChild.nextSibling || null);
							} else if (productLink.children.length > 0) {
								// Insérer avant le premier élément enfant
								productLink.insertBefore(quantityClone, productLink.children[0]);
							} else {
								// Sinon, ajouter à la fin
								productLink.appendChild(quantityClone);
							}
						}
					}
					// Ne pas supprimer le div.ux-mini-cart-qty pour éviter de casser la structure
					// Juste le masquer si nécessaire
					qtyDiv.style.display = 'none';
				}
			}
		});
	}
	*/

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

		// Contrôles de zoom et position pour la photo centrale
		const centerZoom = configurator.querySelector('#wc-pc13-center-zoom');
		const centerAxisX = configurator.querySelector('#wc-pc13-center-position-x');
		const centerAxisY = configurator.querySelector('#wc-pc13-center-position-y');

		if (centerZoom) {
			// Empêcher la propagation des événements
			centerZoom.addEventListener('click', (e) => e.stopPropagation());
			centerZoom.addEventListener('mousedown', (e) => e.stopPropagation());
			centerZoom.addEventListener('input', function (event) {
				event.stopPropagation();
				state.center.scale = parseFloat(event.target.value);
				const clamped = clampTransformValues(state.center);
				state.center.scale = clamped.scale;
				applyTransforms();
				savePayload();
			});
		}

		if (centerAxisX) {
			// Empêcher la propagation des événements
			centerAxisX.addEventListener('click', (e) => e.stopPropagation());
			centerAxisX.addEventListener('mousedown', (e) => e.stopPropagation());
			centerAxisX.addEventListener('input', function (event) {
				event.stopPropagation();
				state.center.x = -parseFloat(event.target.value);
				const clamped = clampTransformValues(state.center);
				state.center.x = clamped.x;
				applyTransforms();
				savePayload();
			});
		}

		if (centerAxisY) {
			// Empêcher la propagation des événements
			centerAxisY.addEventListener('click', (e) => e.stopPropagation());
			centerAxisY.addEventListener('mousedown', (e) => e.stopPropagation());
			centerAxisY.addEventListener('input', function (event) {
				event.stopPropagation();
				state.center.y = -parseFloat(event.target.value);
				const clamped = clampTransformValues(state.center);
				state.center.y = clamped.y;
				applyTransforms();
				savePayload();
			});
		}

		if (numbersToggle) {
			numbersToggle.checked = !!state.showNumbers;
			// Définir l'état initial des champs des chiffres
			const numbersFields = configurator.querySelector(selectors.numbersFields);
			if (numbersFields) {
				if (state.showNumbers) {
					numbersFields.style.display = 'flex';
					numbersFields.classList.add('is-active');
				} else {
					numbersFields.style.display = 'none';
					numbersFields.classList.remove('is-active');
				}

				// Empêcher les clics sur le div de déclencher la checkbox parente
				numbersFields.addEventListener('click', function (e) {
					e.stopPropagation();
				});
				numbersFields.addEventListener('mousedown', function (e) {
					e.stopPropagation();
				});
			}
			// Ajouter un gestionnaire sur le label parent pour empêcher les clics sur numbers-fields de déclencher le toggle
			const numbersToggleLabel = numbersToggle.closest('.wc-pc13-toggle');
			if (numbersToggleLabel) {
				numbersToggleLabel.addEventListener('click', function (e) {
					// Si le clic est sur un toggle enfant (ombre portée, halo lumineux), permettre le clic
					const clickedCheckbox = e.target.closest('input[type="checkbox"]');
					if (clickedCheckbox &&
						(clickedCheckbox.id === 'wc-pc13-number-shadow-enabled' || clickedCheckbox.id === 'wc-pc13-number-glow-enabled')) {
						// Laisser passer le clic pour les toggles enfants
						return;
					}
					// Si le clic est sur le label d'un toggle enfant, permettre aussi
					const clickedToggleLabel = e.target.closest('.wc-pc13-toggle');
					if (clickedToggleLabel && clickedToggleLabel !== numbersToggleLabel) {
						const toggleCheckbox = clickedToggleLabel.querySelector('input[type="checkbox"]');
						if (toggleCheckbox &&
							(toggleCheckbox.id === 'wc-pc13-number-shadow-enabled' || toggleCheckbox.id === 'wc-pc13-number-glow-enabled')) {
							// Laisser passer le clic pour les toggles enfants
							return;
						}
					}
					// Si le clic est sur un input de type color ou range, permettre le clic
					if (e.target.type === 'color' || e.target.type === 'range') {
						return;
					}
					// Si le clic est sur numbers-fields ou ses enfants (mais pas sur les toggles enfants), empêcher
					if (e.target.closest('.wc-pc13-numbers-fields') && !e.target.closest('.wc-pc13-number-effects-row')) {
						e.preventDefault();
						e.stopPropagation();
						return false;
					}
				}, true); // Utiliser capture phase pour intercepter avant le label
			}

			numbersToggle.addEventListener('change', handleNumbersToggle);
		}

		if (numbersColor) {
			// Empêcher la propagation des événements pour éviter de déclencher le toggle parent
			numbersColor.addEventListener('click', (e) => e.stopPropagation());
			numbersColor.addEventListener('mousedown', (e) => e.stopPropagation());
			numbersColor.addEventListener('change', handleNumbersColorChange);
		}

		if (numbersSize) {
			// Empêcher la propagation des événements de clic et mousedown pour éviter de déclencher le toggle parent
			numbersSize.addEventListener('click', (e) => e.stopPropagation());
			numbersSize.addEventListener('mousedown', (e) => e.stopPropagation());
			numbersSize.addEventListener('input', handleNumbersSizeChange);
		}

		if (numbersDistanceInput) {
			// Empêcher la propagation des événements de clic et mousedown pour éviter de déclencher le toggle parent
			numbersDistanceInput.addEventListener('click', (e) => e.stopPropagation());
			numbersDistanceInput.addEventListener('mousedown', (e) => e.stopPropagation());
			numbersDistanceInput.addEventListener('input', handleNumbersDistanceChange);
		}

		const numberTypeSelect = configurator.querySelector(selectors.numberType);
		if (numberTypeSelect) {
			numberTypeSelect.value = state.numbers.numberType || 'arabic';
			// Empêcher la propagation des événements pour éviter de déclencher le toggle parent
			numberTypeSelect.addEventListener('click', (e) => e.stopPropagation());
			numberTypeSelect.addEventListener('mousedown', (e) => e.stopPropagation());
			numberTypeSelect.addEventListener('change', handleNumberTypeChange);
		}

		const intermediatePointsSelect = configurator.querySelector(selectors.intermediatePoints);
		if (intermediatePointsSelect) {
			intermediatePointsSelect.value = state.numbers.intermediatePoints || 'without';
			// Empêcher la propagation des événements pour éviter de déclencher le toggle parent
			intermediatePointsSelect.addEventListener('click', (e) => e.stopPropagation());
			intermediatePointsSelect.addEventListener('mousedown', (e) => e.stopPropagation());
			intermediatePointsSelect.addEventListener('change', handleIntermediatePointsChange);
		}

		const numberShadowEnabled = configurator.querySelector(selectors.numberShadowEnabled);
		const numberShadowIntensity = configurator.querySelector(selectors.numberShadowIntensity);
		const numberShadowFields = configurator.querySelector(selectors.numberShadowFields);

		if (numberShadowEnabled) {
			numberShadowEnabled.checked = !!(state.numbers.shadow && state.numbers.shadow.enabled);
			numberShadowEnabled.addEventListener('change', handleNumberShadowEnabledChange);
			// S'assurer que le label parent ne bloque pas le clic
			const shadowToggleLabel = numberShadowEnabled.closest('.wc-pc13-toggle');
			if (shadowToggleLabel) {
				// Empêcher la propagation pour que le clic sur le label toggle ne soit pas intercepté par le label parent
				shadowToggleLabel.addEventListener('click', (e) => {
					// Vérifier si le clic est bien sur ce toggle (pas sur un élément des numbers-fields)
					const isClickOnThisToggle = shadowToggleLabel.contains(e.target) &&
						!e.target.closest('.wc-pc13-numbers-fields') &&
						(e.target === shadowToggleLabel ||
							e.target === numberShadowEnabled ||
							e.target === shadowToggleLabel.querySelector('span') ||
							e.target.closest('input') === numberShadowEnabled);

					if (isClickOnThisToggle) {
						// Si le clic est sur le span ou le label, déclencher le checkbox
						if (e.target !== numberShadowEnabled && e.target.tagName !== 'INPUT') {
							e.preventDefault();
							e.stopPropagation();
							numberShadowEnabled.checked = !numberShadowEnabled.checked;
							// Déclencher l'événement change manuellement
							const changeEvent = new Event('change', { bubbles: true });
							numberShadowEnabled.dispatchEvent(changeEvent);
							return false;
						}
						// Empêcher la propagation vers le label parent
						e.stopPropagation();
					}
				}, true); // Utiliser capture phase pour intercepter avant le label parent
			}
			if (numberShadowFields) {
				numberShadowFields.style.display = (state.numbers.shadow && state.numbers.shadow.enabled) ? 'block' : 'none';
			}
		}

		if (numberShadowIntensity) {
			numberShadowIntensity.value = (state.numbers.shadow && state.numbers.shadow.intensity) || 5;
			numberShadowIntensity.disabled = !(state.numbers.shadow && state.numbers.shadow.enabled);
			// Empêcher la propagation des événements pour éviter de déclencher le toggle parent
			numberShadowIntensity.addEventListener('click', (e) => e.stopPropagation());
			numberShadowIntensity.addEventListener('mousedown', (e) => e.stopPropagation());
			numberShadowIntensity.addEventListener('input', handleNumberShadowIntensityChange);
		}

		const numberGlowEnabled = configurator.querySelector(selectors.numberGlowEnabled);
		const numberGlowIntensity = configurator.querySelector(selectors.numberGlowIntensity);
		const numberGlowFields = configurator.querySelector(selectors.numberGlowFields);

		if (numberGlowEnabled) {
			numberGlowEnabled.checked = !!(state.numbers.glow && state.numbers.glow.enabled);
			numberGlowEnabled.addEventListener('change', handleNumberGlowEnabledChange);
			// S'assurer que le label parent ne bloque pas le clic
			const glowToggleLabel = numberGlowEnabled.closest('.wc-pc13-toggle');
			if (glowToggleLabel) {
				// Empêcher la propagation pour que le clic sur le label toggle ne soit pas intercepté par le label parent
				glowToggleLabel.addEventListener('click', (e) => {
					// Vérifier si le clic est bien sur ce toggle (pas sur un élément des numbers-fields)
					const isClickOnThisToggle = glowToggleLabel.contains(e.target) &&
						!e.target.closest('.wc-pc13-numbers-fields') &&
						(e.target === glowToggleLabel ||
							e.target === numberGlowEnabled ||
							e.target === glowToggleLabel.querySelector('span') ||
							e.target.closest('input') === numberGlowEnabled);

					if (isClickOnThisToggle) {
						// Si le clic est sur le span ou le label, déclencher le checkbox
						if (e.target !== numberGlowEnabled && e.target.tagName !== 'INPUT') {
							e.preventDefault();
							e.stopPropagation();
							numberGlowEnabled.checked = !numberGlowEnabled.checked;
							// Déclencher l'événement change manuellement
							const changeEvent = new Event('change', { bubbles: true });
							numberGlowEnabled.dispatchEvent(changeEvent);
							return false;
						}
						// Empêcher la propagation vers le label parent
						e.stopPropagation();
					}
				}, true); // Utiliser capture phase pour intercepter avant le label parent
			}
			if (numberGlowFields) {
				numberGlowFields.style.display = (state.numbers.glow && state.numbers.glow.enabled) ? 'block' : 'none';
			}
		}

		const numberGlowColor = configurator.querySelector(selectors.numberGlowColor);
		if (numberGlowColor) {
			// Initialiser la couleur du halo (blanc par défaut)
			if (!state.numbers.glow) {
				state.numbers.glow = { enabled: false, intensity: 10, color: '#ffffff' };
			}
			// Initialiser la couleur du glow si elle n'est pas définie (blanc par défaut)
			if (!state.numbers.glow.color) {
				state.numbers.glow.color = '#ffffff';
			}
			// S'assurer que la valeur du sélecteur correspond à la couleur du state
			numberGlowColor.value = state.numbers.glow.color;
			numberGlowColor.disabled = !(state.numbers.glow && state.numbers.glow.enabled);
			// Empêcher la propagation des événements pour éviter de déclencher le toggle parent
			numberGlowColor.addEventListener('click', (e) => {
				e.stopPropagation();
			}, true);
			numberGlowColor.addEventListener('mousedown', (e) => {
				e.stopPropagation();
			}, true);
			numberGlowColor.addEventListener('change', handleNumberGlowColorChange);
			numberGlowColor.addEventListener('input', handleNumberGlowColorChange);
			// S'assurer que le sélecteur de couleur peut être utilisé même si le glow n'est pas activé
			numberGlowColor.addEventListener('focus', (e) => {
				e.stopPropagation();
			}, true);
		}

		if (numberGlowIntensity) {
			// S'assurer que le slider a les bonnes valeurs min/max (gauche = min, droite = max)
			numberGlowIntensity.min = '1';
			numberGlowIntensity.max = '30';

			// S'assurer que l'intensité est au minimum 1
			if (state.numbers.glow && state.numbers.glow.intensity !== undefined) {
				if (state.numbers.glow.intensity < 1) {
					state.numbers.glow.intensity = 1;
				}
			}
			const intensityValue = (state.numbers.glow && state.numbers.glow.intensity) || 10;
			numberGlowIntensity.value = Math.max(1, Math.min(30, intensityValue));
			// S'assurer que la valeur du slider est au minimum 1
			if (parseInt(numberGlowIntensity.value, 10) < 1) {
				numberGlowIntensity.value = 1;
				if (state.numbers.glow) {
					state.numbers.glow.intensity = 1;
				}
			}
			numberGlowIntensity.disabled = !(state.numbers.glow && state.numbers.glow.enabled);
			// Empêcher la propagation des événements pour éviter de déclencher le toggle parent
			numberGlowIntensity.addEventListener('click', (e) => e.stopPropagation());
			numberGlowIntensity.addEventListener('mousedown', (e) => e.stopPropagation());
			numberGlowIntensity.addEventListener('input', handleNumberGlowIntensityChange);
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
				// Forcer la sélection du centre et définir le slot cible AVANT de cliquer sur le fileInput
				state.currentSlot = 'center';
				selectSlot('center');
				const fileInput = configurator.querySelector(selectors.fileInput);
				if (fileInput) {
					// S'assurer que le slot cible est bien défini AVANT le clic
					uploadTargetSlot = 'center';
					fileInput.dataset.targetSlot = 'center';
					state.currentSlot = 'center';

					// Debug
					if (window.WCPC13_DEBUG) {
						console.log('centerSelectBtn click - uploadTargetSlot:', uploadTargetSlot, 'state.currentSlot:', state.currentSlot, 'dataset.targetSlot:', fileInput.dataset.targetSlot);
					}

					// Cliquer sur l'input file
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
				// S'assurer que state.currentSlot est bien défini
				const targetSlot = state.currentSlot || 'center';
				uploadTargetSlot = targetSlot;
				if (fileInput && fileInput.dataset) {
					fileInput.dataset.targetSlot = targetSlot;
				}
				console.log('Upload button clicked - targetSlot:', targetSlot, 'state.currentSlot:', state.currentSlot);
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
			saveEmailBtn.addEventListener('click', (event) => {
				event.preventDefault();
				if (shareLoading) {
					return;
				}
				openEmailModal(saveEmailBtn);
			});
		}

		// Gestion de la modale email
		const emailModal = document.querySelector(selectors.emailModal);
		const emailModalClose = emailModal ? emailModal.querySelector(selectors.emailModalClose) : null;
		const emailModalCancel = emailModal ? emailModal.querySelector(selectors.emailModalCancel) : null;
		const emailModalSubmit = emailModal ? emailModal.querySelector(selectors.emailModalSubmit) : null;
		const emailInput = document.querySelector(selectors.emailInput);

		if (emailModalClose) {
			emailModalClose.addEventListener('click', () => {
				closeEmailModal();
			});
		}
		if (emailModalCancel) {
			emailModalCancel.addEventListener('click', () => {
				closeEmailModal();
			});
		}
		if (emailModal) {
			emailModal.addEventListener('click', (event) => {
				if (event.target === emailModal) {
					closeEmailModal();
				}
			});
		}
		if (emailModalSubmit && emailInput) {
			emailModalSubmit.addEventListener('click', async () => {
				const email = emailInput.value.trim();
				if (!email) {
					emailInput.focus();
					return;
				}
				// Validation basique de l'email
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!emailRegex.test(email)) {
					window.alert(WCPC13.labels?.invalid_email || 'Email invalide');
					emailInput.focus();
					return;
				}
				await saveShareAndSendEmail(email, saveEmailBtn);
				closeEmailModal();
			});
			// Permettre la soumission avec Enter
			emailInput.addEventListener('keypress', (event) => {
				if (event.key === 'Enter') {
					emailModalSubmit.click();
				}
			});
		}

		const showSlotsToggle = configurator.querySelector(selectors.showSlotsToggle);
		if (showSlotsToggle) {
			showSlotsToggle.checked = !!state.showSlots;
			// Gérer l'affichage/masquage du div des options des slots
			const slotsFields = configurator.querySelector('.wc-pc13-slots-fields');
			if (slotsFields) {
				if (state.showSlots) {
					slotsFields.style.display = 'flex';
					slotsFields.classList.add('is-active');
				} else {
					slotsFields.style.display = 'none';
					slotsFields.classList.remove('is-active');
				}
				// Empêcher les clics sur le div de déclencher la checkbox parente
				slotsFields.addEventListener('click', function (e) {
					e.stopPropagation();
				});
				slotsFields.addEventListener('mousedown', function (e) {
					e.stopPropagation();
				});
			}
			// Ajouter un gestionnaire sur le label parent pour empêcher les clics sur slots-fields de déclencher le toggle
			const slotsToggleLabel = showSlotsToggle.closest('.wc-pc13-toggle');
			if (slotsToggleLabel) {
				slotsToggleLabel.addEventListener('click', function (e) {
					// Laisser passer les clics sur les éléments interactifs internes
					if (e.target.closest('input, button, select, .wc-pc13-toggle, .wp-picker-container')) {
						return;
					}
					// Si le clic est sur slots-fields ou ses enfants non-interactifs, empêcher le déclenchement du toggle parent
					if (e.target.closest('.wc-pc13-slots-fields')) {
						e.preventDefault();
						e.stopPropagation();
						return false;
					}
				}, true); // Utiliser capture phase
			}
			showSlotsToggle.addEventListener('change', (e) => {
				state.showSlots = !!e.target.checked;
				// Afficher ou masquer les champs des options des slots
				if (slotsFields) {
					if (state.showSlots) {
						slotsFields.style.display = 'flex';
						slotsFields.classList.add('is-active');
					} else {
						slotsFields.style.display = 'none';
						slotsFields.classList.remove('is-active');
					}
				}
				// Si on masque les slots, forcer la sélection sur le centre et mettre la taille au maximum
				if (!state.showSlots) {
					selectSlot('center');
					// Mettre la taille centrale au maximum
					const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
					if (centerSizeRange && state.centerMax) {
						state.center.size = state.centerMax;
						centerSizeRange.value = state.centerMax;

						// Mettre à jour l'affichage du pourcentage
						const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
						if (valueDisplay && state.centerMax > 0) {
							valueDisplay.textContent = '100%';
						}
					}
				}
				applyTransforms();
				updateSelectionUI();
				updateRingDimensions(true); // Synchroniser la position des chiffres
				savePayload();
			});
		}

		// Gestion du modal d'aide
		const helpBtn = configurator.querySelector(selectors.helpBtn);
		const helpModal = document.querySelector(selectors.helpModal);
		const helpModalClose = helpModal ? helpModal.querySelector(selectors.helpModalClose) : null;
		const helpModalCancel = helpModal ? helpModal.querySelector(selectors.helpModalCancel) : null;
		const helpForm = helpModal ? helpModal.querySelector(selectors.helpForm) : null;

		if (helpBtn) {
			helpBtn.addEventListener('click', () => {
				openHelpModal();
			});
		}

		if (helpModalClose) {
			helpModalClose.addEventListener('click', () => {
				closeHelpModal();
			});
		}

		if (helpModalCancel) {
			helpModalCancel.addEventListener('click', () => {
				closeHelpModal();
			});
		}

		if (helpModal) {
			helpModal.addEventListener('click', (event) => {
				if (event.target === helpModal) {
					closeHelpModal();
				}
			});
		}

		if (helpForm) {
			helpForm.addEventListener('submit', submitHelpForm);
		}

		// Gestion du modal de partage
		const shareModal = document.querySelector(selectors.shareModal);
		const shareModalClose = shareModal ? shareModal.querySelector(selectors.shareModalClose) : null;
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

		// Bouton de recherche Unsplash
		const searchUnsplashBtn = configurator.querySelector(selectors.searchUnsplashBtn);
		if (searchUnsplashBtn) {
			searchUnsplashBtn.addEventListener('click', (event) => {
				event.preventDefault();
				openUnsplashModal();
			});
		}

		// Modal de recherche Unsplash
		const unsplashModal = document.querySelector(selectors.unsplashModal);
		if (unsplashModal) {
			const modalClose = unsplashModal.querySelector(selectors.unsplashModalClose);
			const modalOverlay = unsplashModal.querySelector(selectors.unsplashModalOverlay);
			const searchInput = unsplashModal.querySelector(selectors.unsplashSearchInput);
			const searchSubmit = unsplashModal.querySelector(selectors.unsplashSearchSubmit);

			// Fermer le modal
			const closeModal = () => {
				unsplashModal.style.display = 'none';
				document.body.style.overflow = '';
			};

			if (modalClose) {
				modalClose.addEventListener('click', closeModal);
			}
			if (modalOverlay) {
				modalOverlay.addEventListener('click', closeModal);
			}

			// Recherche au clic sur le bouton
			if (searchSubmit) {
				searchSubmit.addEventListener('click', () => {
					const query = searchInput ? searchInput.value.trim() : '';
					if (query) {
						searchUnsplashImages(query);
					}
				});
			}

			// Recherche avec Enter
			if (searchInput) {
				searchInput.addEventListener('keypress', (e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						const query = searchInput.value.trim();
						if (query) {
							searchSubmit.click();
						}
					}
				});
			}

			// Gestion des suggestions de recherche
			const suggestionTags = unsplashModal.querySelectorAll('.wc-pc13-suggestion-tag');
			suggestionTags.forEach((tag) => {
				tag.addEventListener('click', () => {
					const query = tag.dataset.query || tag.textContent.trim();
					if (query && searchInput) {
						searchInput.value = query;
						searchUnsplashImages(query);
					}
				});
			});
		}
	}

	function bindHandsControls() {
		const colorInput = document.querySelector(selectors.colorInput);
		const handsWrapper = document.querySelector('.wc-pc13-hands');

		// Animer les aiguilles jusqu'à l'heure actuelle avec une animation sympa
		animateHandsToCurrentTime();

		if (colorInput) {
			state.color = colorInput.value;
			colorInput.addEventListener('change', (event) => {
				state.color = event.target.value;
				updateHandsColor();
				savePayload();
			});
			updateHandsColor();
		}

		// Gérer le changement de couleur de fond
		const backgroundColorInput = document.querySelector(selectors.backgroundColorInput);
		if (backgroundColorInput) {
			state.backgroundColor = backgroundColorInput.value || '#ffffff';
			backgroundColorInput.addEventListener('change', (event) => {
				state.backgroundColor = event.target.value;
				updateBackgroundColor();
				savePayload();
			});
			updateBackgroundColor();
		}

		// Gérer le changement de diamètre
		const diameterInput = document.querySelector('#wc-pc13-diameter');
		if (diameterInput) {
			// Initialiser le diamètre depuis la valeur sélectionnée
			state.diameter = parseInt(diameterInput.value, 10) || 40;
			// Extraire le prix depuis l'attribut data-price de l'option sélectionnée
			const selectedOption = diameterInput.options[diameterInput.selectedIndex];
			if (selectedOption && selectedOption.dataset.price) {
				state.diameterPrice = parseFloat(selectedOption.dataset.price) || 59;
			}
			updateTotalPrice();

			diameterInput.addEventListener('change', (event) => {
				state.diameter = parseInt(event.target.value, 10) || 40;
				// Extraire le prix depuis l'attribut data-price de l'option sélectionnée
				const selectedOption = event.target.options[event.target.selectedIndex];
				if (selectedOption && selectedOption.dataset.price) {
					state.diameterPrice = parseFloat(selectedOption.dataset.price) || 59;
				}
				updateTotalPrice();
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

	function updateTotalPrice() {
		const totalPriceElement = document.querySelector('#wc-pc13-total-price');
		const addToCartPriceElement = document.querySelector('#wc-pc13-add-to-cart-price');
		const price = state.diameterPrice || 59;

		if (totalPriceElement) {
			totalPriceElement.textContent = Math.round(price) + '€';
		}

		if (addToCartPriceElement) {
			addToCartPriceElement.textContent = Math.round(price) + '€';
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

	function updateBackgroundColor() {
		const backgroundColor = state.backgroundColor || '#fafafa';
		const clockFace = document.querySelector('.wc-pc13-clock-face');
		if (clockFace) {
			clockFace.style.background = backgroundColor;
		}
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

	function animateHandsToCurrentTime() {
		const handsWrapper = document.querySelector('.wc-pc13-hands');
		if (!handsWrapper) {
			return;
		}

		const hourHand = handsWrapper.querySelector('.wc-pc13-hand.hour');
		const minuteHand = handsWrapper.querySelector('.wc-pc13-hand.minute');
		const secondHand = handsWrapper.querySelector('.wc-pc13-hand.second');

		// Positionner les aiguilles à 0° (midi) initialement
		if (hourHand) {
			hourHand.style.transition = 'none';
			hourHand.style.transform = 'rotate(0deg)';
		}
		if (minuteHand) {
			minuteHand.style.transition = 'none';
			minuteHand.style.transform = 'rotate(0deg)';
		}
		if (secondHand) {
			secondHand.style.transition = 'none';
			secondHand.style.transform = 'rotate(0deg)';
		}

		// Forcer un reflow pour que la transition s'applique
		void handsWrapper.offsetHeight;

		// Calculer l'heure actuelle
		const now = new Date();
		const hours = now.getHours() % 12;
		const minutes = now.getMinutes();
		const seconds = now.getSeconds();

		const targetHourAngle = (hours * 30) + (minutes * 0.5);
		const targetMinuteAngle = (minutes * 6) + (seconds * 0.1);
		const targetSecondAngle = seconds * 6;

		// Appliquer une transition plus longue et sympa pour l'animation initiale
		if (hourHand) {
			hourHand.style.transition = 'transform 2s cubic-bezier(0.4, 0, 0.2, 1)';
			hourHand.style.transform = `rotate(${targetHourAngle}deg)`;
		}
		if (minuteHand) {
			minuteHand.style.transition = 'transform 2s cubic-bezier(0.4, 0, 0.2, 1)';
			minuteHand.style.transform = `rotate(${targetMinuteAngle}deg)`;
		}
		if (secondHand && state.secondHand !== 'none') {
			secondHand.style.transition = 'transform 2s cubic-bezier(0.4, 0, 0.2, 1)';
			secondHand.style.transform = `rotate(${targetSecondAngle}deg)`;
		}

		// Après l'animation, démarrer l'horloge normale
		setTimeout(() => {
			if (hourHand) {
				hourHand.style.transition = 'transform 0.3s ease-out';
			}
			if (minuteHand) {
				minuteHand.style.transition = 'transform 0.3s ease-out';
			}
			if (secondHand) {
				secondHand.style.transition = 'none';
			}
			startHandsClock();
		}, 2000); // 2 secondes pour l'animation initiale
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

			let rafId = null;
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

					// Marquer qu'on est en train de déplacer
					if (!isDragging) {
						isDragging = true;
					}
				}

				// Convertir les pixels en pourcentage réel par rapport à la taille du conteneur
				// Déplacement adouci et inversé pour une sensation plus fluide
				const percentPerPixel = (100 / containerSize) * 0.65;
				const deltaXPercent = -deltaX * percentPerPixel;
				const deltaYPercent = -deltaY * percentPerPixel;

				targetState.x = initialX + deltaXPercent;
				targetState.y = initialY + deltaYPercent;
				clampTransformValues(targetState);

				// Utiliser requestAnimationFrame pour optimiser les mises à jour pendant le drag
				// skipExpensiveUpdates = true pour éviter updateRingDimensions pendant le drag
				if (rafId === null) {
					rafId = requestAnimationFrame(() => {
						applyTransforms(true); // skipExpensiveUpdates = true pendant le drag
						rafId = null;
					});
				}
			};

			const handleUp = (upEvent) => {
				if (upEvent.pointerId !== pointerId) {
					return;
				}
				document.removeEventListener('pointermove', handleMove);
				document.removeEventListener('pointerup', handleUp);

				// Annuler le requestAnimationFrame en cours si nécessaire
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}

				// Si on a déplacé, sauvegarder et mettre à jour l'UI une seule fois à la fin
				if (hasMoved) {
					isDragging = false; // Réactiver les transitions
					// Réactiver les transitions sur tous les éléments
					const configurator = document.querySelector(selectors.configurator);
					if (configurator) {
						configurator.querySelectorAll('.wc-pc13-slot-image, .wc-pc13-center-image').forEach((el) => {
							el.style.transition = ''; // Réactiver les transitions CSS
						});
					}
					applyTransforms(false); // Réappliquer toutes les mises à jour
					savePayload();
					updateSelectionUI();
				} else {
					isDragging = false;
				}

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
			state.center.image_url_display = centerDemo.image_url; // Pour les démos, utiliser la même URL
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
				state.slots[i].image_url_display = slotDemo.image_url; // Pour les démos, utiliser la même URL
				state.slots[i].x = slotDemo.x ?? 0;
				state.slots[i].y = slotDemo.y ?? 0;
				state.slots[i].scale = slotDemo.scale ?? 1;
				filledCount++;
			} else if (centerDemo && centerDemo.image_url) {
				// Fallback: utiliser l'image centrale si pas d'image disponible pour ce slot
				state.slots[i].attachment_id = 0;
				state.slots[i].image_url = centerDemo.image_url;
				state.slots[i].image_url_display = centerDemo.image_url;
				state.slots[i].x = 0;
				state.slots[i].y = 0;
				state.slots[i].scale = 1.3;
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
			// Sauvegarder le contenu original
			const originalContent = fillUnsplashBtn.innerHTML;
			fillUnsplashBtn.disabled = true;
			fillUnsplashBtn.classList.add('is-loading');
			fillUnsplashBtn.innerHTML = '<span class="wc-pc13-loading-spinner"></span> ' + (WCPC13?.labels?.loading_unsplash || 'Chargement...');
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
				// Pour le centre, utiliser l'URL complète (regular/full) pour le PDF et l'affichage
				// car c'est une image de plus haute résolution
				state.center.image_url = images[0].url; // URL haute résolution (regular/full)
				state.center.image_url_display = images[0].url; // Utiliser la même URL haute résolution pour l'affichage
				state.center.attachment_id = 0;
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

				// Calculer le zoom optimal pour remplir le cercle
				let centerSize = state.center.size || 180;
				if (centerSizeRange) {
					centerSize = parseInt(centerSizeRange.value || centerSize, 10);
				}

				// Charger l'image pour obtenir ses dimensions et calculer le zoom optimal
				const img = new Image();
				img.onload = function () {
					state.center.scale = calculateOptimalZoomForCircle(img.width, img.height, centerSize, DEFAULT_CENTER_INSET);
					applyTransforms();
					updateSelectionUI();
					savePayload();
				};
				img.onerror = function () {
					// En cas d'erreur, utiliser un scale par défaut
					state.center.scale = 1.3;
					applyTransforms();
					updateSelectionUI();
					savePayload();
				};
				img.src = images[0].url;
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
					// Pour les slots périphériques, utiliser l'URL complète (regular) pour l'affichage
					// car les images 'small' étaient trop petites et causaient des problèmes de performance
					state.slots[i].image_url = image.url; // URL complète pour le PDF
					state.slots[i].image_url_display = image.url; // Utiliser la même URL haute résolution pour l'affichage
					state.slots[i].x = 0;
					state.slots[i].y = 0;

					// Calculer le zoom optimal pour éviter les bordures blanches
					const img = new Image();
					img.onload = function () {
						const slotSize = state.ringSize || 110;
						state.slots[i].scale = calculateOptimalZoomForCircle(img.width, img.height, slotSize, 2);
						applyTransforms();
						updateSelectionUI();
					};
					img.src = image.url;

					// Valeur par défaut en attendant le calcul
					state.slots[i].scale = 1.5;
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
				fillUnsplashBtn.classList.remove('is-loading');
				// Restaurer le contenu original avec l'icône
				fillUnsplashBtn.innerHTML = '<span class="wc-pc13-fill-unsplash-icon">🎲</span> ' + (WCPC13?.labels?.fill_unsplash || 'Charger des photos aléatoires');
			}
		}
	}

	/**
	 * Ouvre le modal de recherche Unsplash
	 */
	function openUnsplashModal() {
		const unsplashModal = document.querySelector(selectors.unsplashModal);
		const searchInput = unsplashModal ? unsplashModal.querySelector(selectors.unsplashSearchInput) : null;

		if (unsplashModal) {
			unsplashModal.style.display = 'flex';
			document.body.style.overflow = 'hidden';

			// Focus sur l'input de recherche
			if (searchInput) {
				setTimeout(() => {
					searchInput.focus();
				}, 100);
			}

			// Réinitialiser l'affichage
			const grid = unsplashModal.querySelector(selectors.unsplashGrid);
			const loading = unsplashModal.querySelector(selectors.unsplashLoading);
			const empty = unsplashModal.querySelector(selectors.unsplashEmpty);
			const modalBody = unsplashModal.querySelector('.wc-pc13-unsplash-modal-body');
			const suggestions = unsplashModal.querySelector('#wc-pc13-unsplash-suggestions');

			if (grid) grid.innerHTML = '';
			if (loading) loading.style.display = 'none';
			if (empty) empty.style.display = 'none';
			if (suggestions) suggestions.style.display = 'flex';

			// Réinitialiser l'observer de scroll
			if (unsplashScrollObserver) {
				unsplashScrollObserver.disconnect();
				unsplashScrollObserver = null;
			}

			// Supprimer la sentinelle et le loader
			if (modalBody) {
				const sentinel = modalBody.querySelector('#wc-pc13-unsplash-sentinel');
				if (sentinel) sentinel.remove();
				const loadMore = modalBody.querySelector('.wc-pc13-unsplash-load-more');
				if (loadMore) loadMore.remove();
			}

			// Réinitialiser les variables
			unsplashCurrentQuery = '';
			unsplashCurrentPage = 1;
			unsplashLoadingMore = false;
			unsplashHasMore = true;
		}
	}

	// Variables pour le chargement infini
	let unsplashCurrentQuery = '';
	let unsplashCurrentPage = 1;
	let unsplashLoadingMore = false;
	let unsplashHasMore = true;
	let unsplashScrollObserver = null;

	/**
	 * Recherche des images Unsplash par mot-clé
	 */
	async function searchUnsplashImages(query, page = 1, append = false) {
		const unsplashModal = document.querySelector(selectors.unsplashModal);
		if (!unsplashModal) return;

		const grid = unsplashModal.querySelector(selectors.unsplashGrid);
		const loading = unsplashModal.querySelector(selectors.unsplashLoading);
		const empty = unsplashModal.querySelector(selectors.unsplashEmpty);
		const searchSubmit = unsplashModal.querySelector(selectors.unsplashSearchSubmit);
		const modalBody = unsplashModal.querySelector('.wc-pc13-unsplash-modal-body');

		// Si c'est une nouvelle recherche, réinitialiser
		if (!append) {
			unsplashCurrentQuery = query;
			unsplashCurrentPage = 1;
			unsplashHasMore = true;
			if (grid) grid.innerHTML = '';
			if (empty) empty.style.display = 'none';
		}

		// Masquer les suggestions lors d'une recherche (nouvelle ou chargement supplémentaire)
		const suggestions = unsplashModal.querySelector('#wc-pc13-unsplash-suggestions');
		if (suggestions) suggestions.style.display = 'none';

		// Éviter les requêtes multiples
		if (unsplashLoadingMore) {
			return;
		}

		unsplashLoadingMore = true;

		// Afficher le chargement
		if (!append) {
			if (loading) loading.style.display = 'flex';
			if (searchSubmit) searchSubmit.disabled = true;
		} else {
			// Afficher un indicateur de chargement en bas
			showUnsplashLoadingMore(modalBody);
		}

		try {
			const formData = new FormData();
			formData.append('action', 'wc_pc13_fetch_unsplash');
			formData.append('nonce', WCPC13.nonce);
			formData.append('count', '20'); // 20 images par page
			formData.append('query', query);
			formData.append('page', page);

			const response = await fetch(WCPC13.ajax_url, {
				method: 'POST',
				credentials: 'same-origin',
				body: formData,
			});

			if (!response.ok) {
				throw new Error(WCPC13?.labels?.unsplash_error || 'Erreur lors de la recherche');
			}

			const data = await response.json();
			if (!data || !data.success || !data.data || !data.data.images || !Array.isArray(data.data.images)) {
				throw new Error(data?.data?.message || WCPC13?.labels?.unsplash_error || 'Aucune image trouvée');
			}

			const images = data.data.images;

			// Masquer le chargement initial
			if (!append && loading) loading.style.display = 'none';
			if (append) hideUnsplashLoadingMore(modalBody);

			// Vérifier s'il y a plus de résultats
			unsplashHasMore = images.length === 20; // Si on a 20 images, il y a probablement plus

			if (images.length === 0 && !append) {
				// Aucun résultat (seulement pour la première page)
				if (empty) empty.style.display = 'block';
			} else {
				// Afficher les résultats
				if (empty) empty.style.display = 'none';
				if (grid) {
					const startIndex = append ? grid.children.length : 0;
					images.forEach((image, index) => {
						const item = document.createElement('div');
						item.className = 'wc-pc13-unsplash-item';
						item.dataset.index = startIndex + index;

						const img = document.createElement('img');
						img.src = image.thumb || image.url;
						img.alt = `Photo ${startIndex + index + 1}`;
						img.loading = 'lazy';

						// Animation d'apparition
						item.style.opacity = '0';
						item.style.transform = 'scale(0.9)';

						item.appendChild(img);
						grid.appendChild(item);

						// Animation avec délai
						setTimeout(() => {
							item.style.transition = 'all 0.3s ease';
							item.style.opacity = '1';
							item.style.transform = 'scale(1)';
						}, (startIndex + index) * 20);

						// Sélection de l'image
						item.addEventListener('click', () => {
							selectUnsplashImage(image);
						});
					});

					// Configurer l'observer de scroll pour charger plus
					if (unsplashHasMore && !unsplashScrollObserver) {
						setupUnsplashInfiniteScroll(modalBody, grid);
					}
				}
			}
		} catch (error) {
			console.error('Erreur recherche Unsplash:', error);
			if (!append && loading) loading.style.display = 'none';
			if (append) hideUnsplashLoadingMore(modalBody);
			if (empty && !append) {
				empty.style.display = 'block';
				empty.innerHTML = `<p>${error?.message || WCPC13?.labels?.unsplash_error || 'Erreur lors de la recherche'}</p>`;
			}
			unsplashHasMore = false;
		} finally {
			unsplashLoadingMore = false;
			if (searchSubmit) searchSubmit.disabled = false;
		}
	}

	/**
	 * Configure le scroll infini pour charger plus de résultats
	 */
	function setupUnsplashInfiniteScroll(modalBody, grid) {
		if (!modalBody || !grid) return;

		// Créer un élément sentinelle en bas de la grille
		let sentinel = document.getElementById('wc-pc13-unsplash-sentinel');
		if (!sentinel) {
			sentinel = document.createElement('div');
			sentinel.id = 'wc-pc13-unsplash-sentinel';
			sentinel.style.height = '20px';
			grid.parentNode.appendChild(sentinel);
		}

		// Observer pour détecter quand la sentinelle devient visible
		if (unsplashScrollObserver) {
			unsplashScrollObserver.disconnect();
		}

		unsplashScrollObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && unsplashHasMore && !unsplashLoadingMore) {
					unsplashCurrentPage++;
					searchUnsplashImages(unsplashCurrentQuery, unsplashCurrentPage, true);
				}
			});
		}, {
			root: modalBody,
			rootMargin: '100px',
			threshold: 0.1
		});

		unsplashScrollObserver.observe(sentinel);
	}

	/**
	 * Affiche l'indicateur de chargement en bas
	 */
	function showUnsplashLoadingMore(container) {
		if (!container) return;
		let loader = container.querySelector('.wc-pc13-unsplash-load-more');
		if (!loader) {
			loader = document.createElement('div');
			loader.className = 'wc-pc13-unsplash-load-more';
			loader.innerHTML = `
				<div class="wc-pc13-loading-spinner"></div>
				<p>Chargement de plus de résultats...</p>
			`;
			container.appendChild(loader);
		}
		loader.style.display = 'flex';
	}

	/**
	 * Masque l'indicateur de chargement en bas
	 */
	function hideUnsplashLoadingMore(container) {
		if (!container) return;
		const loader = container.querySelector('.wc-pc13-unsplash-load-more');
		if (loader) {
			loader.style.display = 'none';
		}
	}

	/**
	 * Sélectionne une image Unsplash et l'applique au centre
	 */
	function selectUnsplashImage(image) {
		if (!image || !image.url) {
			return;
		}

		// Fermer le modal
		const unsplashModal = document.querySelector(selectors.unsplashModal);
		if (unsplashModal) {
			unsplashModal.style.display = 'none';
			document.body.style.overflow = '';
		}

		// Appliquer l'image au centre
		const target = state.center;
		target.image_url = image.url;
		target.image_url_display = image.url;
		target.attachment_id = 0;
		target.x = 0;
		target.y = 0;

		// Calculer le zoom optimal
		const configurator = document.querySelector(selectors.configurator);
		const centerSizeRange = configurator ? configurator.querySelector(selectors.centerSizeRange) : null;
		let centerSize = target.size || 180;
		if (centerSizeRange) {
			centerSize = parseInt(centerSizeRange.value || centerSize, 10);
		}

		// Charger l'image pour obtenir ses dimensions et calculer le zoom optimal
		const img = new Image();
		img.onload = function () {
			target.scale = calculateOptimalZoomForCircle(img.width, img.height, centerSize, DEFAULT_CENTER_INSET);
			applyTransforms();
			updateSelectionUI();
			savePayload();
			scheduleLivePreviewUpdate();

			// Déplacer la page vers l'aperçu de l'horloge
			scrollToPreview();
		};
		img.onerror = function () {
			// En cas d'erreur, utiliser un scale par défaut
			target.scale = 1.3;
			applyTransforms();
			updateSelectionUI();
			savePayload();
			scheduleLivePreviewUpdate();

			// Déplacer la page vers l'aperçu de l'horloge
			scrollToPreview();
		};
		img.src = image.url;
	}

	/**
	 * Fait défiler la page vers l'aperçu de l'horloge
	 */
	function scrollToPreview() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) return;

		const preview = configurator.querySelector(selectors.preview);
		if (preview) {
			// Attendre un peu pour que l'image soit appliquée
			setTimeout(() => {
				preview.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
					inline: 'nearest'
				});
			}, 100);
		}
	}

	async function init() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		// Déplacer les modals vers le body pour éviter les problèmes de z-index avec les thèmes
		const modalsToMove = [
			selectors.unsplashModal,
			selectors.helpModal,
			selectors.shareModal,
			selectors.emailModal,
			selectors.arModal
		];
		modalsToMove.forEach(selector => {
			const modal = document.querySelector(selector);
			if (modal && modal.parentElement !== document.body) {
				document.body.appendChild(modal);
			}
		});

		// Détecter le mode (peripheral ou central)
		const mode = configurator.dataset.mode || 'peripheral';

		// Charger la configuration partagée si un paramètre share est présent
		await loadSharedConfig();

		// Si mode central, désactiver les photos périphériques par défaut et mettre la taille centrale à 100%
		if (mode === 'central' && !sharedConfigLoaded) {
			state.showSlots = false;
		}

		const preview = configurator.querySelector(selectors.preview);
		const ringSizeInput = configurator.querySelector(selectors.slotSizeRange);
		const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
		const numbersToggle = configurator.querySelector(selectors.numbersToggle);
		const numbersColor = configurator.querySelector(selectors.numbersColor);
		const numbersSize = configurator.querySelector(selectors.numbersSize);
		const numbersDistanceInput = configurator.querySelector(selectors.numbersDistance);
		if (centerSizeRange) {
			// Si mode central, utiliser 100% de la taille maximale
			if (mode === 'central' && !sharedConfigLoaded) {
				// Attendre que le preview soit rendu pour calculer la taille
				setTimeout(() => {
					const preview = configurator.querySelector(selectors.preview);
					if (preview) {
						const previewWidth = preview.offsetWidth || 720;
						state.centerMax = Math.round(previewWidth * 0.95);
						state.center.size = state.centerMax;
						centerSizeRange.max = state.centerMax;
						centerSizeRange.value = state.center.size;

						// Mettre à jour l'affichage du pourcentage
						const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
						if (valueDisplay && state.centerMax > 0) {
							const percentage = Math.round((state.center.size / state.centerMax) * 100);
							valueDisplay.textContent = `${percentage}%`;
						}

						applyTransforms();
					}
				}, 100);
				// Initialiser avec une valeur par défaut en attendant le calcul
				const initialCenterSize = parseInt(centerSizeRange.value || 180, 10);
				const sanitized = Number.isNaN(initialCenterSize) ? (state.center.size || 180) : initialCenterSize;
				state.center.size = Math.max(CENTER_MIN_SIZE, sanitized);
				centerSizeRange.value = state.center.size;
			} else {
				const initialCenterSize = sharedConfigLoaded ? state.center.size : parseInt(centerSizeRange.value || 180, 10);
				const sanitized = Number.isNaN(initialCenterSize) ? (state.center.size || 180) : initialCenterSize;
				state.center.size = Math.max(CENTER_MIN_SIZE, sanitized);
				centerSizeRange.value = state.center.size;
			}

			// Afficher ou masquer le label du slider selon si une image centrale est présente ou si mode central
			const centerSizeLabel = configurator.querySelector('.wc-pc13-center-size-label');
			if (centerSizeLabel) {
				if (state.center.image_url || mode === 'central') {
					centerSizeLabel.style.display = 'block';
				} else {
					centerSizeLabel.style.display = 'none';
				}
			}

			// Afficher ou masquer les contrôles de zoom/position selon si une image centrale est présente
			const centerControls = configurator.querySelector('.wc-pc13-center-controls');
			if (centerControls) {
				if (state.center.image_url) {
					centerControls.style.display = 'block';

					// Mettre à jour les valeurs des contrôles
					const centerZoom = centerControls.querySelector('#wc-pc13-center-zoom');
					const centerAxisX = centerControls.querySelector('#wc-pc13-center-position-x');
					const centerAxisY = centerControls.querySelector('#wc-pc13-center-position-y');

					if (centerZoom) {
						centerZoom.value = state.center.scale || 1;
					}
					if (centerAxisX) {
						centerAxisX.value = -(state.center.x || 0);
					}
					if (centerAxisY) {
						centerAxisY.value = -(state.center.y || 0);
					}
				} else {
					centerControls.style.display = 'none';
				}
			}

			// Mettre à jour l'affichage du pourcentage
			const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
			if (valueDisplay && state.centerMax > 0) {
				const percentage = Math.round((state.center.size / state.centerMax) * 100);
				valueDisplay.textContent = `${percentage}%`;
			}
		}

		if (numbersToggle && !sharedConfigLoaded) {
			state.showNumbers = !!numbersToggle.checked;
		}
		if (numbersToggle && sharedConfigLoaded) {
			numbersToggle.checked = !!state.showNumbers;
		}
		// Définir l'état initial des champs des chiffres
		const numbersFields = configurator.querySelector(selectors.numbersFields);
		if (numbersFields) {
			if (state.showNumbers) {
				numbersFields.style.display = 'flex';
				numbersFields.classList.add('is-active');
			} else {
				numbersFields.style.display = 'none';
				numbersFields.classList.remove('is-active');
			}
		}

		const showSlotsToggle = configurator.querySelector(selectors.showSlotsToggle);
		if (showSlotsToggle) {
			// Si mode central, forcer la désactivation des photos périphériques
			if (mode === 'central') {
				state.showSlots = false;
				showSlotsToggle.checked = false;
				showSlotsToggle.disabled = true; // Désactiver le toggle en mode central
				// Masquer visuellement les slots
				const preview = configurator.querySelector(selectors.preview);
				if (preview) {
					preview.classList.add('hide-slots');
				}
			} else {
				if (!sharedConfigLoaded) {
					showSlotsToggle.checked = !!state.showSlots;
				} else {
					showSlotsToggle.checked = !!state.showSlots;
				}
				showSlotsToggle.disabled = false;
			}

			// Gérer l'affichage/masquage du div des options des slots
			const slotsFields = configurator.querySelector('.wc-pc13-slots-fields');
			if (slotsFields) {
				if (state.showSlots) {
					slotsFields.style.display = 'flex';
					slotsFields.classList.add('is-active');
				} else {
					slotsFields.style.display = 'none';
					slotsFields.classList.remove('is-active');
				}
			}

			// Si les photos périphériques sont désactivées, mettre la taille centrale au maximum
			if (!state.showSlots && state.centerMax) {
				const centerSizeRange = configurator.querySelector(selectors.centerSizeRange);
				if (centerSizeRange) {
					state.center.size = state.centerMax;
					centerSizeRange.value = state.centerMax;

					// Mettre à jour l'affichage du pourcentage
					const valueDisplay = configurator.querySelector('#wc-pc13-center-size-value');
					if (valueDisplay && state.centerMax > 0) {
						valueDisplay.textContent = '100%';
					}
				}
			}

			// Mettre à jour l'affichage du message d'aide
			updateRingDimensions();
		}

		if (numbersColor && numbersColor.value && !sharedConfigLoaded) {
			state.numbers.color = numbersColor.value;
		}

		// Initialiser le type de chiffres
		const numberTypeSelect = configurator.querySelector(selectors.numberType);
		if (numberTypeSelect) {
			if (sharedConfigLoaded && state.numbers.numberType) {
				numberTypeSelect.value = state.numbers.numberType;
			} else {
				state.numbers.numberType = numberTypeSelect.value || 'arabic';
			}
		}

		// Initialiser les points intermédiaires
		const intermediatePointsSelect = configurator.querySelector(selectors.intermediatePoints);
		if (intermediatePointsSelect) {
			if (sharedConfigLoaded && state.numbers.intermediatePoints) {
				intermediatePointsSelect.value = state.numbers.intermediatePoints;
			} else {
				state.numbers.intermediatePoints = intermediatePointsSelect.value || 'without';
			}
		}

		// Initialiser la couleur de fond depuis l'input HTML si pas de config partagée
		const backgroundColorInput = configurator.querySelector(selectors.backgroundColorInput);
		if (backgroundColorInput && !sharedConfigLoaded) {
			state.backgroundColor = backgroundColorInput.value || '#fafafa';
			updateBackgroundColor();
		}

		// Initialiser l'ombre portée
		const numberShadowEnabled = configurator.querySelector(selectors.numberShadowEnabled);
		const numberShadowIntensity = configurator.querySelector(selectors.numberShadowIntensity);
		const numberShadowFields = configurator.querySelector(selectors.numberShadowFields);
		if (numberShadowEnabled) {
			if (sharedConfigLoaded && state.numbers.shadow) {
				numberShadowEnabled.checked = !!(state.numbers.shadow.enabled);
			} else {
				state.numbers.shadow = state.numbers.shadow || { enabled: false, intensity: 5 };
				numberShadowEnabled.checked = state.numbers.shadow.enabled;
			}
		}
		if (numberShadowIntensity) {
			if (sharedConfigLoaded && state.numbers.shadow) {
				numberShadowIntensity.value = state.numbers.shadow.intensity || 5;
			} else {
				state.numbers.shadow = state.numbers.shadow || { enabled: false, intensity: 5 };
				numberShadowIntensity.value = state.numbers.shadow.intensity;
			}
			numberShadowIntensity.disabled = !(state.numbers.shadow && state.numbers.shadow.enabled);
		}
		if (numberShadowFields) {
			numberShadowFields.style.display = (state.numbers.shadow && state.numbers.shadow.enabled) ? 'block' : 'none';
		}

		// Initialiser le halo lumineux
		const numberGlowEnabled = configurator.querySelector(selectors.numberGlowEnabled);
		const numberGlowIntensity = configurator.querySelector(selectors.numberGlowIntensity);
		const numberGlowColor = configurator.querySelector(selectors.numberGlowColor);
		const numberGlowFields = configurator.querySelector(selectors.numberGlowFields);
		if (numberGlowEnabled) {
			if (sharedConfigLoaded && state.numbers.glow) {
				numberGlowEnabled.checked = !!(state.numbers.glow.enabled);
			} else {
				state.numbers.glow = state.numbers.glow || { enabled: false, intensity: 10, color: '#ffffff' };
				numberGlowEnabled.checked = state.numbers.glow.enabled;
			}
		}
		if (numberGlowIntensity) {
			// S'assurer que le slider a les bonnes valeurs min/max (gauche = min, droite = max)
			numberGlowIntensity.min = '1';
			numberGlowIntensity.max = '30';

			if (sharedConfigLoaded && state.numbers.glow) {
				// S'assurer que l'intensité est au minimum 1
				const intensity = Math.max(1, state.numbers.glow.intensity || 10);
				if (state.numbers.glow.intensity < 1) {
					state.numbers.glow.intensity = intensity;
				}
				numberGlowIntensity.value = intensity;
			} else {
				state.numbers.glow = state.numbers.glow || { enabled: false, intensity: 10, color: '#ffffff' };
				// S'assurer que l'intensité est au minimum 1
				if (state.numbers.glow.intensity < 1) {
					state.numbers.glow.intensity = 1;
				}
				numberGlowIntensity.value = state.numbers.glow.intensity;
			}
			numberGlowIntensity.disabled = !(state.numbers.glow && state.numbers.glow.enabled);
		}
		if (numberGlowColor) {
			// Initialiser le glow si nécessaire (blanc par défaut)
			if (!state.numbers.glow) {
				state.numbers.glow = { enabled: false, intensity: 10, color: '#ffffff' };
			}
			// Initialiser la couleur du glow si elle n'est pas définie (blanc par défaut)
			if (!state.numbers.glow.color) {
				state.numbers.glow.color = '#ffffff';
			}
			// Utiliser la couleur du glow si disponible depuis la config partagée
			if (sharedConfigLoaded && state.numbers.glow && state.numbers.glow.color) {
				numberGlowColor.value = state.numbers.glow.color;
			} else {
				// Utiliser la couleur du state ou blanc par défaut
				const defaultColor = state.numbers.glow.color || '#ffffff';
				state.numbers.glow.color = defaultColor;
				numberGlowColor.value = defaultColor;
			}
			// Le sélecteur de couleur ne doit être désactivé que si le glow n'est pas activé
			numberGlowColor.disabled = !(state.numbers.glow && state.numbers.glow.enabled);
		}
		if (numberGlowFields) {
			numberGlowFields.style.display = (state.numbers.glow && state.numbers.glow.enabled) ? 'block' : 'none';
		}

		if (numbersSize) {
			const initialSize = sharedConfigLoaded ? state.numbers.size : parseInt(numbersSize.value || state.numbers.size, 10);
			if (!Number.isNaN(initialSize)) {
				state.numbers.size = Math.max(12, Math.min(150, initialSize));
			}
			numbersSize.value = state.numbers.size;
		}

		if (numbersDistanceInput) {
			let initialDistance;
			if (sharedConfigLoaded) {
				initialDistance = (typeof state.numbers.distance === 'number' && Number.isFinite(state.numbers.distance) && state.numbers.distance >= 0)
					? state.numbers.distance
					: null; // null pour utiliser la valeur par défaut
			} else {
				const inputValue = parseInt(numbersDistanceInput.value, 10);
				// Si la valeur est 0 (valeur par défaut du template), utiliser la valeur par défaut selon l'état de l'option
				if (inputValue === 0 && !state.numbers.distance) {
					initialDistance = null; // null pour utiliser la valeur par défaut
				} else {
					initialDistance = (!Number.isNaN(inputValue) && inputValue >= 0) ? inputValue : null;
				}
			}

			// Si initialDistance est null, calculer selon l'état de l'option "Afficher les chiffres"
			if (initialDistance === null || initialDistance === undefined) {
				const maxValue = parseInt(numbersDistanceInput.max, 10) || 350;
				// Si l'option "Afficher les chiffres" est activée, utiliser 77% par défaut, sinon 90%
				const defaultPercentage = state.showNumbers ? 0.77 : 0.9;
				initialDistance = Math.round(maxValue * defaultPercentage);
			}

			state.numbers.distance = Math.max(0, initialDistance);
			numbersDistanceInput.value = state.numbers.distance;

			// Mettre à jour l'affichage de la valeur en pourcentage
			const valueDisplay = configurator.querySelector('#wc-pc13-number-distance-value');
			if (valueDisplay && numbersDistanceInput.max) {
				const maxValue = parseInt(numbersDistanceInput.max, 10);
				if (maxValue > 0) {
					const percentage = Math.round((state.numbers.distance / maxValue) * 100);
					valueDisplay.textContent = `${percentage}%`;
				}
			}
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

		// Initialisation de l'état du bouton PDF - Supprimée pour éviter le blocage
		/*
				const pdfBtn = configurator.querySelector(selectors.downloadPdf);
				if (pdfBtn) {
					pdfBtn.classList.add('wc-pc13-pdf-generating');
					pdfBtn.disabled = true;
				}
		*/

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
		// Animer les aiguilles jusqu'à l'heure actuelle avec une animation sympa au chargement
		animateHandsToCurrentTime();
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
		const price = data.price || state.diameterPrice || 59;
		const priceDisplay = Math.round(price) + '€';
		const cartUrl = (typeof WCPC13 !== 'undefined' && WCPC13.cart_url) ? WCPC13.cart_url : '/cart/';
		notification.innerHTML = `
			<div class="wc-pc13-notification-content">
				${data.preview_url ? `<img src="${data.preview_url}" alt="Horloge" class="wc-pc13-notification-image">` : ''}
				<div class="wc-pc13-notification-text">
					<strong>${data.message || 'Produit ajouté au panier'}</strong>
					${data.product_name ? `<p>${data.product_name}</p>` : ''}
					${data.cart_count ? `<p class="wc-pc13-cart-count">${data.cart_count} article${data.cart_count > 1 ? 's' : ''} dans le panier</p>` : ''}
					<p class="wc-pc13-notification-price"><strong>${priceDisplay}</strong></p>
					<a href="${cartUrl}" class="wc-pc13-cart-button">Voir le panier</a>
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
		const shareModal = document.querySelector(selectors.shareModal);
		const shareUrlInput = document.querySelector(selectors.shareUrlInput);
		const productId = configurator ? configurator.dataset.product : null;

		if (!productId) {
			window.alert('ID produit manquant');
			return;
		}

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
		const shareModal = document.querySelector(selectors.shareModal);
		if (shareModal) {
			shareModal.style.display = 'none';
		}
	}

	function openEmailModal(triggerBtn = null) {
		const emailModal = document.querySelector(selectors.emailModal);
		const emailInput = document.querySelector(selectors.emailInput);
		if (emailModal) {
			emailModal.style.display = 'flex';
			if (emailInput) {
				emailInput.value = '';
				// Focus sur l'input après un court délai pour que la modale soit visible
				setTimeout(() => {
					emailInput.focus();
				}, 100);
			}
		}
	}

	function closeEmailModal() {
		const emailModal = document.querySelector(selectors.emailModal);
		const emailInput = configurator.querySelector(selectors.emailInput);
		if (emailModal) {
			emailModal.style.display = 'none';
		}
		if (emailInput) {
			emailInput.value = '';
		}
	}

	function openHelpModal() {
		const helpModal = document.querySelector(selectors.helpModal);
		if (helpModal) {
			helpModal.style.display = 'flex';
			const emailInput = helpModal.querySelector('#wc-pc13-help-email');
			if (emailInput) {
				emailInput.focus();
			}
		}
	}

	function closeHelpModal() {
		const helpModal = document.querySelector(selectors.helpModal);
		const helpForm = configurator.querySelector(selectors.helpForm);
		const helpMessage = configurator.querySelector(selectors.helpModalMessage);
		if (helpModal) {
			helpModal.style.display = 'none';
		}
		if (helpForm) {
			helpForm.reset();
		}
		if (helpMessage) {
			helpMessage.style.display = 'none';
			helpMessage.textContent = '';
			helpMessage.className = 'wc-pc13-help-modal-message';
		}
	}

	async function submitHelpForm(event) {
		event.preventDefault();
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) {
			return;
		}

		const form = event.target;
		const submitBtn = form.querySelector('.wc-pc13-help-modal-submit');
		const helpMessage = configurator.querySelector(selectors.helpModalMessage);

		if (!submitBtn || !helpMessage) {
			return;
		}

		const formData = new FormData(form);
		const data = {
			action: 'wc_pc13_send_help',
			nonce: WCPC13.nonce,
			type: formData.get('type'),
			email: formData.get('email'),
			subject: formData.get('subject'),
			message: formData.get('message'),
		};

		// Validation côté client
		if (!data.type || !data.email || !data.subject || !data.message) {
			helpMessage.textContent = WCPC13.labels?.help_required_fields || 'Tous les champs sont requis.';
			helpMessage.className = 'wc-pc13-help-modal-message error';
			helpMessage.style.display = 'block';
			return;
		}

		// Désactiver le bouton pendant l'envoi
		submitBtn.disabled = true;
		submitBtn.textContent = WCPC13.labels?.sending || 'Envoi en cours...';
		helpMessage.style.display = 'none';

		try {
			const response = await fetch(WCPC13.ajax_url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams(data),
			});

			const result = await response.json();

			if (result.success) {
				helpMessage.textContent = result.data.message || WCPC13.labels?.help_success || 'Message envoyé avec succès !';
				helpMessage.className = 'wc-pc13-help-modal-message success';
				helpMessage.style.display = 'block';
				form.reset();

				// Fermer le modal après 3 secondes
				setTimeout(() => {
					closeHelpModal();
				}, 3000);
			} else {
				helpMessage.textContent = result.data.message || WCPC13.labels?.help_error || 'Une erreur est survenue.';
				helpMessage.className = 'wc-pc13-help-modal-message error';
				helpMessage.style.display = 'block';
			}
		} catch (error) {
			helpMessage.textContent = WCPC13.labels?.help_error || 'Une erreur est survenue lors de l\'envoi.';
			helpMessage.className = 'wc-pc13-help-modal-message error';
			helpMessage.style.display = 'block';
		} finally {
			submitBtn.disabled = false;
			submitBtn.textContent = WCPC13.labels?.help_submit || 'Envoyer';
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
				// S'assurer que image_url_display est défini (fallback sur image_url si absent)
				if (!state.center.image_url_display && state.center.image_url) {
					state.center.image_url_display = state.center.image_url;
				}
			}
			if (sharedConfig.slots) {
				state.slots = { ...state.slots, ...sharedConfig.slots };
				// S'assurer que image_url_display est défini pour tous les slots
				Object.keys(state.slots).forEach((slotKey) => {
					if (state.slots[slotKey] && !state.slots[slotKey].image_url_display && state.slots[slotKey].image_url) {
						state.slots[slotKey].image_url_display = state.slots[slotKey].image_url;
					}
				});
			}
			if (sharedConfig.color) {
				state.color = sharedConfig.color;
			}
			if (sharedConfig.background_color) {
				state.backgroundColor = sharedConfig.background_color;
			}
			if (sharedConfig.diameter) {
				state.diameter = sharedConfig.diameter;
				// Si un prix est fourni dans la config, l'utiliser, sinon le calculer depuis l'attribut data-price
				if (sharedConfig.diameter_price) {
					state.diameterPrice = sharedConfig.diameter_price;
				} else {
					const diameterSelect = configurator.querySelector('#wc-pc13-diameter');
					if (diameterSelect) {
						const option = diameterSelect.querySelector(`option[value="${sharedConfig.diameter}"]`);
						if (option && option.dataset.price) {
							state.diameterPrice = parseFloat(option.dataset.price) || 59;
						}
					}
				}
				updateTotalPrice();
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
				state.numbers = {
					...state.numbers,
					...sharedConfig.numbers,
					numberType: sharedConfig.numbers.numberType || state.numbers.numberType || 'arabic',
					intermediatePoints: sharedConfig.numbers.intermediatePoints || state.numbers.intermediatePoints || 'without',
					shadow: sharedConfig.numbers.shadow || state.numbers.shadow || { enabled: false, intensity: 5 },
					glow: sharedConfig.numbers.glow || state.numbers.glow || { enabled: false, intensity: 10 },
				};
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

			// Valider et nettoyer les URLs d'images invalides (404)
			await validateAllImages();

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

		// Appliquer la couleur de fond
		const backgroundColorInput = configurator.querySelector(selectors.backgroundColorInput);
		if (backgroundColorInput && state.backgroundColor) {
			backgroundColorInput.value = state.backgroundColor;
			updateBackgroundColor();
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

		// Appliquer le type de chiffres
		const numberTypeSelect = configurator.querySelector(selectors.numberType);
		if (numberTypeSelect && state.numbers.numberType) {
			numberTypeSelect.value = state.numbers.numberType;
		}

		// Appliquer les points intermédiaires
		const intermediatePointsSelect = configurator.querySelector(selectors.intermediatePoints);
		if (intermediatePointsSelect && state.numbers.intermediatePoints) {
			intermediatePointsSelect.value = state.numbers.intermediatePoints;
		}

		// Mettre à jour le prix total
		updateTotalPrice();

		// Appliquer les images
		updatePreview();

		// Réorganiser le mini-cart au chargement - DESACTIVE
		// setTimeout(reorganizeMiniCart, 500);

		// Écouter les événements de mise à jour du panier
		if (typeof jQuery !== 'undefined') {
			jQuery(document.body).on('added_to_cart', function () {
				// setTimeout(reorganizeMiniCart, 100);
			});
			jQuery(document.body).on('removed_from_cart', function () {
				// setTimeout(reorganizeMiniCart, 100);
			});
			jQuery(document.body).on('updated_cart_totals', function () {
				// setTimeout(reorganizeMiniCart, 100);
			});
		}

		/**
	 * Initialise la fonctionnalité AR (réalité augmentée) avec WebXR (Three.js).
	 * Charge Three.js dynamiquement uniquement au clic.
	 */
		function initAR() {
			const configurator = document.querySelector(selectors.configurator);
			if (!configurator) return;

			const arBtn = configurator.querySelector(selectors.arBtn);
			if (!arBtn) return;

			// Vérifier si l'environnement est sécurisé (HTTPS ou localhost)
			const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname.endsWith('.local');
			// Note : .local est souvent traité comme sécurisé par Safari mais pas forcément Chrome/Firefox sans flags.
			// On avertira l'utilisateur si l'API XR n'est pas dispo.

			let threeLoaded = false;

			// Fonction pour charger Three.js
			const loadThreeJS = () => {
				return new Promise((resolve, reject) => {
					if (threeLoaded || window.THREE) {
						threeLoaded = true;
						resolve();
						return;
					}
					const script = document.createElement('script');
					script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
					script.onload = () => {
						threeLoaded = true;
						resolve();
					};
					script.onerror = reject;
					document.head.appendChild(script);
				});
			};

			arBtn.addEventListener('click', async (e) => {
				e.preventDefault();

				// Vérification support WebXR
				if (!navigator.xr) {
					window.alert("Votre navigateur ne supporte pas la Réalité Augmentée (WebXR), ou vous n'êtes pas en HTTPS.");
					return;
				}
				const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
				if (!isArSupported) {
					window.alert("Le mode AR n'est pas supporté par votre appareil ou navigateur.");
					return;
				}

				// Feedback chargement
				const originalText = arBtn.innerHTML;
				arBtn.innerHTML = '<span class="wc-pc13-loading-spinner" style="display:inline-block; width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-right:8px;"></span> Chargement 3D...';

				try {
					// 1. Charger Three.js
					await loadThreeJS();

					// 2. Générer la texture de l'horloge
					const canvas = await capturePreview(1, { printMode: false, skipLivePreviewUpdate: true });
					const texture = new THREE.CanvasTexture(canvas);

					// 3. Lancer la session AR
					startARSession(texture);

				} catch (err) {
					console.error("Erreur AR:", err);
					window.alert("Impossible de lancer l'AR : " + err.message);
				} finally {
					arBtn.innerHTML = originalText;
				}
			});

			async function startARSession(texture) {
				// Configuration Three.js de base pour AR
				const scene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
				const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
				renderer.setSize(window.innerWidth, window.innerHeight);
				renderer.xr.enabled = true;

				// Lumière
				const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
				scene.add(light);

				// Création de l'horloge 3D (Cylindre plat)
				// Diamètre réel : on prend 40cm (0.4m) par défaut ou la valeur configurée
				let realDiameter = 0.4;
				const diameterSelect = document.querySelector('#wc-pc13-diameter');
				if (diameterSelect) realDiameter = parseInt(diameterSelect.value) / 100;

				const geometry = new THREE.CylinderGeometry(realDiameter / 2, realDiameter / 2, 0.01, 64);
				const material = new THREE.MeshBasicMaterial({ map: texture });
				// Ajuster la texture pour qu'elle s'affiche correctement sur le dessus du cylindre
				// Par défaut le mapping cylindrique peut être bizarre sur les faces, on va simplifier avec un cercle pour l'affichage AR face user
				// Ou mieux : on utilise un Cercle plan, plus simple.

				const clockGroup = new THREE.Group();
				// On crée un disque plat
				const diskGeo = new THREE.CircleGeometry(realDiameter / 2, 64);
				const diskMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
				const clockMesh = new THREE.Mesh(diskGeo, diskMat);
				// Orientation initiale : face à la caméra (Z-up dans WebXR souvent)
				// On mettra à jour l'orientation avec le hit-test
				clockGroup.add(clockMesh);

				// Réticule pour viser
				const reticleGeo = new THREE.RingGeometry(0.1, 0.11, 32).rotateX(-Math.PI / 2);
				const reticleMat = new THREE.MeshBasicMaterial();
				const reticle = new THREE.Mesh(reticleGeo, reticleMat);
				reticle.matrixAutoUpdate = false;
				reticle.visible = false;
				scene.add(reticle);

				// Session AR
				const session = await navigator.xr.requestSession('immersive-ar', {
					requiredFeatures: ['hit-test', 'dom-overlay'],
					domOverlay: { root: document.body } // Fallback si supporté
				});
				renderer.xr.setReferenceSpaceType('local');
				renderer.xr.setSession(session);

				// Créer un container temporaire pour le rendu si besoin, mais WebXR prend le controle du framebuffer
				// Pas besoin d'append le renderer.domElement au body pour immersive-ar, le browser gère.

				// Boucle de rendu
				let hitTestSource = null;
				let hitTestSourceRequested = false;

				// Gestion du clic pour placer l'objet
				session.addEventListener('select', () => {
					if (reticle.visible) {
						const clone = clockGroup.clone();
						clone.position.setFromMatrixPosition(reticle.matrix);
						clone.quaternion.setFromRotationMatrix(reticle.matrix);
						// Ajuster la rotation pour que l'horloge soit face à nous si c'est sur un mur
						// Le reticle s'aligne à la surface normale.
						// Si c'est un mur (vertical), le "Haut" du reticle est la normale du mur. 
						// On veut que l'horloge soit plaquée au mur.
						// CircleGeometry regarde vers +Z par défaut. 
						// On doit faire pivoter le cercle pour s'aligner avec le mur.
						clone.rotateX(-Math.PI / 2); // Rotation pour s'aligner avec le plan du reticle

						scene.add(clone);
					}
				});

				const renderLoop = (timestamp, frame) => {
					if (frame) {
						const referenceSpace = renderer.xr.getReferenceSpace();
						const session = renderer.xr.getSession();

						if (hitTestSourceRequested === false) {
							session.requestReferenceSpace('viewer').then((referenceSpace) => {
								session.requestHitTestSource({ space: referenceSpace }).then((source) => {
									hitTestSource = source;
								});
							});
							session.addEventListener('end', () => {
								hitTestSourceRequested = false;
								hitTestSource = null;
								// Nettoyage éventuel
							});
							hitTestSourceRequested = true;
						}

						if (hitTestSource) {
							const hitTestResults = frame.getHitTestResults(hitTestSource);
							if (hitTestResults.length > 0) {
								const hit = hitTestResults[0];
								reticle.visible = true;
								reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
							} else {
								reticle.visible = false;
							}
						}
					}
					renderer.render(scene, camera);
				};

				renderer.setAnimationLoop(renderLoop);
			}
		} // Closes initAR function

		// initAR(); // Désactivé pour masquer la fonctionnalité AR
	}

	/**
	 * Met à jour les fragments du panier après génération du PDF
	 */
	function updateCartFragments() {
		const configurator = document.querySelector(selectors.configurator);
		if (!configurator) return;

		// Vérifier si un PDF a été généré
		const pdfIdInput = configurator.querySelector(selectors.pdfIdInput);
		const pdfUrlInput = configurator.querySelector(selectors.pdfUrlInput);
		const hasPdf = (pdfIdInput && pdfIdInput.value) || (pdfUrlInput && pdfUrlInput.value);

		// Mettre à jour l'état du bouton PDF
		const pdfBtn = configurator.querySelector(selectors.downloadPdf);
		if (pdfBtn) {
			pdfBtn.classList.remove('wc-pc13-pdf-generating');

			if (hasPdf) {
				// PDF généré avec succès
				pdfBtn.classList.add('wc-pc13-pdf-ready');
				pdfBtn.disabled = false;

				const pdfText = pdfBtn.querySelector('.wc-pc13-pdf-text');
				if (pdfText) {
					pdfText.textContent = WCPC13?.labels?.download_pdf || 'Télécharger en PDF HD';
				}
			} else {
				// Aucun PDF généré - remettre en état d'attente ou d'erreur
				pdfBtn.disabled = true;

				const pdfText = pdfBtn.querySelector('.wc-pc13-pdf-text');
				if (pdfText) {
					pdfText.textContent = 'Erreur génération PDF';
				}
			}

			const spinner = pdfBtn.querySelector('.wc-pc13-pdf-spinner');
			if (spinner) {
				spinner.style.display = 'none';
			}
		}

		// Déclencher la mise à jour des fragments WooCommerce si jQuery est disponible
		if (typeof jQuery !== 'undefined') {
			jQuery(document.body).trigger('wc_fragment_refresh');
		}
	}

	$(init);
})(jQuery);
