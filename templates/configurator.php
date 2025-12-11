<?php
/**
 * Template frontend du configurateur.
 *
 * @package WooCommercePhotoClock13
 *
 * @var int    $product_id       ID produit.
 * @var string $default_hands    Style d’aiguilles.
 * @var string $default_color    Couleur par défaut.
 * @var string $button_text      Libellé du bouton d’ajout au panier.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$hands_colors = array(
	'#111111' => __( 'Noir', 'wc-photo-clock-13' ),
	'#ffffff' => __( 'Blanc', 'wc-photo-clock-13' ),
	'#777777' => __( 'Gris', 'wc-photo-clock-13' ),
	'#cc1f1a' => __( 'Rouge', 'wc-photo-clock-13' ),
);

$normalized_colors = array_change_key_case( $hands_colors, CASE_LOWER );
$default_color_key = strtolower( (string) $default_color );
if ( $default_color && ! array_key_exists( $default_color_key, $normalized_colors ) ) {
	$hands_colors[ $default_color ] = __( 'Personnalisée', 'wc-photo-clock-13' );
}

$button_text = isset( $button_text ) ? $button_text : __( 'Ajouter au panier', 'wc-photo-clock-13' );
$mode = isset( $mode ) ? $mode : 'peripheral';
?>
<div class="wc-pc13-configurator" data-product="<?php echo esc_attr( $product_id ); ?>" data-mode="<?php echo esc_attr( $mode ); ?>">
	<h3><?php esc_html_e( 'Créez votre horloge photo personnalisée', 'wc-photo-clock-13' ); ?></h3>

	<div class="wc-pc13-columns">
		<div class="wc-pc13-preview-column">
			<small class="wc-pc13-silent-note" style="display: block; text-align: center; margin-bottom: 16px; font-size: 12px; color: #666; font-style: italic;">
				🔇 <?php esc_html_e( 'Horloge silencieuse (pas de tic-tac) - Mouvement continu', 'wc-photo-clock-13' ); ?>
			</small>
			<div class="wc-pc13-preview" data-initial-slot-size="110">
				<div class="wc-pc13-clock-face">
					<div class="wc-pc13-ring">
						<?php for ( $i = 1; $i <= 12; $i++ ) : ?>
							<?php
							// Calculer l'angle pour positionner le slot 12 en haut (comme une vraie horloge)
							// Si le 6 est actuellement en haut (à 180°), il faut décaler de 180° pour avoir le 12 en haut
							// Le 12 doit être à l'angle qui met actuellement le 6 en haut, donc 180°
							// Formule: angle = ((i == 12 ? 0 : i) * 30 + 180) % 360
							$base_angle = ( $i == 12 ? 0 : $i ) * 30;
							$angle = ($base_angle + 180) % 360;
							?>
							<div class="wc-pc13-slot" data-slot="<?php echo esc_attr( $i ); ?>" style="--angle: <?php echo esc_attr( $angle ); ?>deg;">
								<div class="wc-pc13-slot-inner">
									<div class="wc-pc13-slot-image"></div>
								</div>
							</div>
						<?php endfor; ?>
					</div>
					<div class="wc-pc13-numbers-overlay">
						<?php for ( $i = 1; $i <= 12; $i++ ) : ?>
							<?php
							// Calculer l'angle pour positionner le 12 en haut (comme une vraie horloge)
							// Si le 6 est actuellement en haut (à 180°), il faut décaler de 180° pour avoir le 12 en haut
							// Formule identique aux slots: angle = ((i == 12 ? 0 : i) * 30 + 180) % 360
							$base_angle = ( $i == 12 ? 0 : $i ) * 30;
							$angle = ($base_angle + 180) % 360;
							?>
							<div class="wc-pc13-number-label" data-number="<?php echo esc_attr( $i ); ?>" style="--angle: <?php echo esc_attr( $angle ); ?>deg;"><?php echo esc_html( $i ); ?></div>
						<?php endfor; ?>
					</div>
					<div class="wc-pc13-center" data-slot="center">
						<div class="wc-pc13-center-image"></div>
					</div>
					<div class="wc-pc13-hands">
						<div class="wc-pc13-hand hour"></div>
						<div class="wc-pc13-hand minute"></div>
						<div class="wc-pc13-hand second"></div>
						<div class="wc-pc13-hands-center"></div>
					</div>
				</div>
				<!-- Panneau flottant pour les contrôles de photo périphérique -->
				<div class="wc-pc13-floating-controls" style="display: none;">
					<button type="button" class="wc-pc13-floating-controls-close" aria-label="<?php esc_attr_e( 'Fermer', 'wc-photo-clock-13' ); ?>">&times;</button>
					<div class="wc-pc13-floating-controls-content">
						<h5 class="wc-pc13-floating-controls-title"><?php esc_html_e( 'Ajuster la photo', 'wc-photo-clock-13' ); ?></h5>
						<label>
							<span><?php esc_html_e( 'Zoom', 'wc-photo-clock-13' ); ?></span>
							<input type="range" min="1" max="5" step="0.01" value="1" data-zoom>
						</label>
						<label>
							<span><?php esc_html_e( 'Position horizontale', 'wc-photo-clock-13' ); ?></span>
							<input type="range" min="-100" max="100" step="1" value="0" data-axis="x">
						</label>
						<label>
							<span><?php esc_html_e( 'Position verticale', 'wc-photo-clock-13' ); ?></span>
							<input type="range" min="-100" max="100" step="1" value="0" data-axis="y">
						</label>
						<div class="wc-pc13-floating-actions">
							<button type="button" class="button button-secondary wc-pc13-floating-upload">
								<?php esc_html_e( 'Charger une photo', 'wc-photo-clock-13' ); ?>
							</button>
							<button type="button" class="button wc-pc13-floating-remove" disabled>
								<?php esc_html_e( 'Supprimer la photo', 'wc-photo-clock-13' ); ?>
							</button>
						</div>
					</div>
				</div>
			</div>
			<p class="wc-pc13-preview-hint"><?php esc_html_e( 'Cliquez sur une zone pour l’éditer.', 'wc-photo-clock-13' ); ?></p>
			<div class="wc-pc13-download-actions">
				<button type="button" class="button button-secondary wc-pc13-download-jpeg">
					<?php esc_html_e( 'Télécharger JPEG', 'wc-photo-clock-13' ); ?>
				</button>
				<button type="button" class="button button-secondary wc-pc13-download-pdf">
					<?php esc_html_e( 'Télécharger en PDF HD', 'wc-photo-clock-13' ); ?>
				</button>
				<button type="button" class="button button-secondary wc-pc13-share-btn">
					<?php esc_html_e( 'Partager', 'wc-photo-clock-13' ); ?>
				</button>
				<button type="button" class="button button-secondary wc-pc13-save-email-btn">
					<?php esc_html_e( 'Sauvegarder par email', 'wc-photo-clock-13' ); ?>
				</button>
			</div>
			<div class="wc-pc13-email-modal" style="display: none;">
				<div class="wc-pc13-email-modal-content">
					<span class="wc-pc13-email-modal-close">&times;</span>
					<h3><?php esc_html_e( 'Sauvegarder par email', 'wc-photo-clock-13' ); ?></h3>
					<div class="wc-pc13-email-form">
						<label for="wc-pc13-email-input"><?php esc_html_e( 'Votre email', 'wc-photo-clock-13' ); ?></label>
						<input type="email" id="wc-pc13-email-input" placeholder="<?php esc_attr_e( 'exemple@email.com', 'wc-photo-clock-13' ); ?>" required>
						<div class="wc-pc13-email-modal-actions">
							<button type="button" class="button button-secondary wc-pc13-email-modal-cancel"><?php esc_html_e( 'Annuler', 'wc-photo-clock-13' ); ?></button>
							<button type="button" class="button button-primary wc-pc13-email-modal-submit"><?php esc_html_e( 'Envoyer', 'wc-photo-clock-13' ); ?></button>
						</div>
					</div>
				</div>
			</div>
			<div class="wc-pc13-share-modal" style="display: none;">
				<div class="wc-pc13-share-modal-content">
					<span class="wc-pc13-share-modal-close">&times;</span>
					<h3><?php esc_html_e( 'Partager votre horloge', 'wc-photo-clock-13' ); ?></h3>
					<div class="wc-pc13-share-options">
						<div class="wc-pc13-share-link">
							<label><?php esc_html_e( 'Lien de partage', 'wc-photo-clock-13' ); ?></label>
							<div class="wc-pc13-share-link-input">
								<input type="text" id="wc-pc13-share-url" readonly>
								<button type="button" class="button wc-pc13-copy-link-btn"><?php esc_html_e( 'Copier', 'wc-photo-clock-13' ); ?></button>
							</div>
						</div>
						<div class="wc-pc13-share-buttons">
							<a href="#" class="wc-pc13-share-email" target="_blank" rel="noopener noreferrer" title="<?php esc_attr_e( 'Partager par email', 'wc-photo-clock-13' ); ?>">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
								</svg>
								<span><?php esc_html_e( 'Email', 'wc-photo-clock-13' ); ?></span>
							</a>
							<a href="#" class="wc-pc13-share-whatsapp" target="_blank" rel="noopener noreferrer" title="<?php esc_attr_e( 'Partager sur WhatsApp', 'wc-photo-clock-13' ); ?>">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="currentColor"/>
								</svg>
								<span><?php esc_html_e( 'WhatsApp', 'wc-photo-clock-13' ); ?></span>
							</a>
							<a href="#" class="wc-pc13-share-facebook" target="_blank" rel="noopener noreferrer" title="<?php esc_attr_e( 'Partager sur Facebook', 'wc-photo-clock-13' ); ?>">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="currentColor"/>
								</svg>
								<span><?php esc_html_e( 'Facebook', 'wc-photo-clock-13' ); ?></span>
							</a>
							<a href="#" class="wc-pc13-share-x" target="_blank" rel="noopener noreferrer" title="<?php esc_attr_e( 'Partager sur X', 'wc-photo-clock-13' ); ?>">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>
								</svg>
								<span><?php esc_html_e( 'X', 'wc-photo-clock-13' ); ?></span>
							</a>
						</div>
					</div>
				</div>
			</div>
			<div class="wc-pc13-demo-actions">
				<button type="button" class="button wc-pc13-fill-unsplash">
					<span class="wc-pc13-fill-unsplash-icon">🎲</span>
					<?php esc_html_e( 'Charger des photos aléatoires', 'wc-photo-clock-13' ); ?>
				</button>
			</div>
			<div class="wc-pc13-add-to-cart">
				<button type="button" class="button button-primary wc-pc13-add-to-cart-btn">
					<?php echo esc_html( $button_text ?? __( 'Ajouter au panier', 'wc-photo-clock-13' ) ); ?>
					<span class="wc-pc13-add-to-cart-price" id="wc-pc13-add-to-cart-price">59€</span>
				</button>
				<p class="wc-pc13-add-to-cart-note"><?php esc_html_e( 'Vos réglages seront ajoutés au panier avec ce produit.', 'wc-photo-clock-13' ); ?></p>
			</div>
			<div class="wc-pc13-tutorial">
				<h4 class="wc-pc13-tutorial-title"><?php esc_html_e( 'Comment utiliser le configurateur', 'wc-photo-clock-13' ); ?></h4>
				<div class="wc-pc13-tutorial-steps">
					<div class="wc-pc13-tutorial-step">
						<span class="wc-pc13-tutorial-icon">1️⃣</span>
						<div class="wc-pc13-tutorial-content">
							<strong><?php esc_html_e( 'Ajoutez vos photos', 'wc-photo-clock-13' ); ?></strong>
							<p><?php esc_html_e( 'Cliquez sur une zone de l\'horloge (centre ou périphérie) puis sélectionnez une image depuis votre ordinateur ou glissez-déposez-la directement.', 'wc-photo-clock-13' ); ?></p>
						</div>
					</div>
					<div class="wc-pc13-tutorial-step">
						<span class="wc-pc13-tutorial-icon">2️⃣</span>
						<div class="wc-pc13-tutorial-content">
							<strong><?php esc_html_e( 'Ajustez et personnalisez', 'wc-photo-clock-13' ); ?></strong>
							<p><?php esc_html_e( 'Utilisez les contrôles à droite pour ajuster le zoom, la position de chaque photo, choisir le diamètre, la couleur des aiguilles et les options d\'affichage.', 'wc-photo-clock-13' ); ?></p>
						</div>
					</div>
					<div class="wc-pc13-tutorial-step">
						<span class="wc-pc13-tutorial-icon">3️⃣</span>
						<div class="wc-pc13-tutorial-content">
							<strong><?php esc_html_e( 'Prévisualisez et ajoutez au panier', 'wc-photo-clock-13' ); ?></strong>
							<p><?php esc_html_e( 'Votre horloge se met à jour en temps réel. Téléchargez un aperçu si besoin, puis ajoutez votre création au panier.', 'wc-photo-clock-13' ); ?></p>
						</div>
					</div>
				</div>
				<div class="wc-pc13-tutorial-tips">
					<p><strong>💡 <?php esc_html_e( 'Astuce', 'wc-photo-clock-13' ); ?>:</strong> <?php esc_html_e( 'Utilisez le bouton "Charger des photos aléatoires" pour tester rapidement le configurateur.', 'wc-photo-clock-13' ); ?></p>
				</div>
			</div>
		</div>

		<div class="wc-pc13-controls-column">
			<div class="wc-pc13-global-settings">
				<div class="wc-pc13-total-price">
					<span class="wc-pc13-total-price-label"><?php esc_html_e( 'Prix total', 'wc-photo-clock-13' ); ?></span>
					<span class="wc-pc13-total-price-value" id="wc-pc13-total-price">59€</span>
				</div>
				<label for="wc-pc13-diameter">
					<span><?php esc_html_e( 'Diamètre de l\'horloge', 'wc-photo-clock-13' ); ?></span>
					<select id="wc-pc13-diameter" name="wc_pc13_diameter">
						<option value="30" data-price="49">30 cm - 49€</option>
						<option value="40" data-price="59" selected>40 cm - 59€</option>
						<option value="50" data-price="69">50 cm - 69€</option>
						<option value="60" data-price="89">60 cm - 89€</option>
						<option value="70" data-price="109">70 cm - 109€</option>
					</select>
					<small class="wc-pc13-diameter-note">
						<?php esc_html_e( 'Impression sur support alu dibond', 'wc-photo-clock-13' ); ?>
						<span class="wc-pc13-info-icon" data-tooltip="<?php echo esc_attr( __( 'L\'alu dibond est un matériau composite constitué de deux feuilles d\'aluminium encadrant une âme en polyéthylène. Ce support rigide et léger offre une excellente résistance aux intempéries et une finition de qualité professionnelle pour vos impressions.', 'wc-photo-clock-13' ) ); ?>">ℹ️</span>
					</small>
				</label>
				<div class="wc-pc13-hand-options">
					<div class="wc-pc13-hand-field">
						<label for="wc-pc13-color"><?php esc_html_e( 'Couleur des aiguilles', 'wc-photo-clock-13' ); ?></label>
						<select id="wc-pc13-color" name="wc_pc13_color">
							<?php foreach ( $hands_colors as $color_value => $color_label ) : ?>
								<option value="<?php echo esc_attr( $color_value ); ?>" <?php selected( strtolower( $default_color ), strtolower( $color_value ) ); ?>>
									<?php echo esc_html( $color_label ); ?>
								</option>
							<?php endforeach; ?>
						</select>
					</div>
					<div class="wc-pc13-hand-field">
						<label for="wc-pc13-second-hand"><?php esc_html_e( 'Trotteuse (aiguille des secondes)', 'wc-photo-clock-13' ); ?></label>
						<select id="wc-pc13-second-hand" name="wc_pc13_second_hand">
							<option value="red"><?php esc_html_e( 'Rouge', 'wc-photo-clock-13' ); ?></option>
							<option value="black" selected><?php esc_html_e( 'Noir', 'wc-photo-clock-13' ); ?></option>
							<option value="none"><?php esc_html_e( 'Pas de trotteuse', 'wc-photo-clock-13' ); ?></option>
						</select>
					</div>
				</div>
				<label for="wc-pc13-background-color">
					<span><?php esc_html_e( 'Couleur de fond de l\'horloge', 'wc-photo-clock-13' ); ?></span>
					<input type="color" id="wc-pc13-background-color" name="wc_pc13_background_color" value="#fafafa">
				</label>
				<div class="wc-pc13-center-panel">
					<div class="wc-pc13-center-actions">
						<button type="button" class="button button-secondary wc-pc13-select-center">
							<?php esc_html_e( 'Remplacer l’image centrale…', 'wc-photo-clock-13' ); ?>
						</button>
						<button type="button" class="button wc-pc13-remove-center" disabled aria-label="<?php echo esc_attr( __( 'Retirer l\'image centrale', 'wc-photo-clock-13' ) ); ?>" data-tooltip="<?php echo esc_attr( __( 'Retirer l\'image centrale', 'wc-photo-clock-13' ) ); ?>">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</button>
					</div>
					<label for="wc-pc13-center-size" class="wc-pc13-center-size-label" style="display: none;">
						<span><?php esc_html_e( 'Diamètre du visuel central', 'wc-photo-clock-13' ); ?></span>
						<input type="range" id="wc-pc13-center-size" name="wc_pc13_center_size" min="120" max="720" step="1" value="180" data-center-size>
						<span class="wc-pc13-range-value" id="wc-pc13-center-size-value">0%</span>
					</label>
					<div class="wc-pc13-center-controls" style="display: none;">
						<label for="wc-pc13-center-zoom">
							<span><?php esc_html_e( 'Zoom', 'wc-photo-clock-13' ); ?></span>
							<input type="range" id="wc-pc13-center-zoom" name="wc_pc13_center_zoom" min="1" max="5" step="0.01" value="1" data-center-zoom>
						</label>
						<label for="wc-pc13-center-position-x">
							<span><?php esc_html_e( 'Position horizontale', 'wc-photo-clock-13' ); ?></span>
							<input type="range" id="wc-pc13-center-position-x" name="wc_pc13_center_position_x" min="-100" max="100" step="1" value="0" data-center-axis="x">
						</label>
						<label for="wc-pc13-center-position-y">
							<span><?php esc_html_e( 'Position verticale', 'wc-photo-clock-13' ); ?></span>
							<input type="range" id="wc-pc13-center-position-y" name="wc_pc13_center_position_y" min="-100" max="100" step="1" value="0" data-center-axis="y">
						</label>
					</div>
				</div>
				<label class="wc-pc13-toggle">
					<input type="checkbox" id="wc-pc13-show-numbers" name="wc_pc13_show_numbers" value="1" checked>
					<span><?php esc_html_e( 'Afficher les chiffres des heures', 'wc-photo-clock-13' ); ?></span>
					<div class="wc-pc13-numbers-fields">
						<div class="wc-pc13-number-style-row">
							<label for="wc-pc13-number-type">
								<span><?php esc_html_e( 'Type de chiffres', 'wc-photo-clock-13' ); ?></span>
								<select id="wc-pc13-number-type" name="wc_pc13_number_type">
									<option value="arabic"><?php esc_html_e( 'Arabes', 'wc-photo-clock-13' ); ?></option>
									<option value="roman"><?php esc_html_e( 'Romains', 'wc-photo-clock-13' ); ?></option>
								</select>
							</label>
							<label for="wc-pc13-intermediate-points">
								<span><?php esc_html_e( 'Points intermédiaires', 'wc-photo-clock-13' ); ?></span>
								<select id="wc-pc13-intermediate-points" name="wc_pc13_intermediate_points">
									<option value="with"><?php esc_html_e( 'Avec points intermédiaires', 'wc-photo-clock-13' ); ?></option>
									<option value="without"><?php esc_html_e( 'Sans points intermédiaires', 'wc-photo-clock-13' ); ?></option>
								</select>
							</label>
						</div>
						<label for="wc-pc13-number-color">
							<span><?php esc_html_e( 'Couleur des chiffres', 'wc-photo-clock-13' ); ?></span>
							<input type="color" id="wc-pc13-number-color" name="wc_pc13_number_color" value="#222222">
						</label>
						<label for="wc-pc13-number-size">
							<span><?php esc_html_e( 'Taille des chiffres', 'wc-photo-clock-13' ); ?></span>
							<input type="range" id="wc-pc13-number-size" name="wc_pc13_number_size" min="16" max="72" step="1" value="32">
						</label>
						<label for="wc-pc13-number-distance">
							<span><?php esc_html_e( 'Distance des chiffres depuis le centre', 'wc-photo-clock-13' ); ?></span>
							<input type="range" id="wc-pc13-number-distance" name="wc_pc13_number_distance" min="0" max="350" step="1" value="270">
							<span class="wc-pc13-range-value" id="wc-pc13-number-distance-value">77%</span>
						</label>
						<div class="wc-pc13-number-effects-row">
							<label class="wc-pc13-toggle">
								<input type="checkbox" id="wc-pc13-number-shadow-enabled" name="wc_pc13_number_shadow_enabled" value="1">
								<span><?php esc_html_e( 'Ombre portée', 'wc-photo-clock-13' ); ?></span>
							</label>
							<label class="wc-pc13-toggle">
								<input type="checkbox" id="wc-pc13-number-glow-enabled" name="wc_pc13_number_glow_enabled" value="1">
								<span><?php esc_html_e( 'Halo lumineux', 'wc-photo-clock-13' ); ?></span>
							</label>
						</div>
						<div class="wc-pc13-number-shadow-fields" style="display: none;">
							<label for="wc-pc13-number-shadow-intensity">
								<span><?php esc_html_e( 'Intensité de l\'ombre', 'wc-photo-clock-13' ); ?></span>
								<input type="range" id="wc-pc13-number-shadow-intensity" name="wc_pc13_number_shadow_intensity" min="0" max="20" step="1" value="5">
							</label>
						</div>
						<div class="wc-pc13-number-glow-fields" style="display: none;">
							<label for="wc-pc13-number-glow-intensity">
								<span><?php esc_html_e( 'Intensité du halo', 'wc-photo-clock-13' ); ?></span>
								<input type="range" id="wc-pc13-number-glow-intensity" name="wc_pc13_number_glow_intensity" min="0" max="30" step="1" value="10">
							</label>
						</div>
					</div>
				</label>
				<label class="wc-pc13-toggle">
					<input type="checkbox" id="wc-pc13-show-slots" name="wc_pc13_show_slots" value="1" checked>
					<span><?php esc_html_e( 'Afficher les photos périphériques', 'wc-photo-clock-13' ); ?></span>
				</label>
					<label for="wc-pc13-slot-size"><?php esc_html_e( 'Taille des photos périphériques', 'wc-photo-clock-13' ); ?></label>
					<input type="range" id="wc-pc13-slot-size" name="wc_pc13_slot_size" min="50" max="160" step="1" value="110">
					<div class="wc-pc13-slot-styling">
						<h5><?php esc_html_e( 'Style des photos périphériques', 'wc-photo-clock-13' ); ?></h5>
						<label class="wc-pc13-toggle">
							<input type="checkbox" id="wc-pc13-slot-border-enabled" name="wc_pc13_slot_border_enabled" value="1">
							<span><?php esc_html_e( 'Activer le contour', 'wc-photo-clock-13' ); ?></span>
						</label>
						<div class="wc-pc13-slot-border-fields">
							<label for="wc-pc13-slot-border-color">
								<span><?php esc_html_e( 'Couleur du contour', 'wc-photo-clock-13' ); ?></span>
								<input type="color" id="wc-pc13-slot-border-color" name="wc_pc13_slot_border_color" value="#000000">
							</label>
							<label for="wc-pc13-slot-border-width">
								<span><?php esc_html_e( 'Épaisseur du contour', 'wc-photo-clock-13' ); ?></span>
								<input type="range" id="wc-pc13-slot-border-width" name="wc_pc13_slot_border_width" min="1" max="10" step="1" value="2">
							</label>
						</div>
						<label class="wc-pc13-toggle">
							<input type="checkbox" id="wc-pc13-slot-shadow-enabled" name="wc_pc13_slot_shadow_enabled" value="1">
							<span><?php esc_html_e( 'Activer l\'ombre portée', 'wc-photo-clock-13' ); ?></span>
						</label>
					</div>
			</div>

			<div class="wc-pc13-slot-editor">
				<h4 class="wc-pc13-slot-title"><?php esc_html_e( 'Zone sélectionnée', 'wc-photo-clock-13' ); ?></h4>
				<div class="wc-pc13-slot-fields">
					<label class="wc-pc13-upload-label">
						<span><?php esc_html_e( 'Photo', 'wc-photo-clock-13' ); ?></span>
						<button type="button" class="wc-pc13-upload-button button button-primary">
							<?php esc_html_e( 'Choisir une image…', 'wc-photo-clock-13' ); ?>
						</button>
						<input type="file" accept="image/*">
					</label>
					<button type="button" class="button wc-pc13-remove" disabled><?php esc_html_e( 'Supprimer la photo', 'wc-photo-clock-13' ); ?></button>

					<label>
						<span><?php esc_html_e( 'Zoom', 'wc-photo-clock-13' ); ?></span>
						<input type="range" min="1" max="5" step="0.01" value="1" data-zoom>
					</label>

					<label>
						<span><?php esc_html_e( 'Position horizontale', 'wc-photo-clock-13' ); ?></span>
						<input type="range" min="-100" max="100" step="1" value="0" data-axis="x">
					</label>

					<label>
						<span><?php esc_html_e( 'Position verticale', 'wc-photo-clock-13' ); ?></span>
						<input type="range" min="-100" max="100" step="1" value="0" data-axis="y">
					</label>
				</div>
			</div>
		</div>
	</div>

	<input type="hidden" name="wc_pc13_payload" id="wc-pc13-payload">
	<input type="hidden" name="wc_pc13_preview_id" id="wc-pc13-preview-id">
	<input type="hidden" name="wc_pc13_preview_url" id="wc-pc13-preview-url">
	<input type="hidden" name="wc_pc13_pdf_id" id="wc-pc13-pdf-id">
	<input type="hidden" name="wc_pc13_pdf_url" id="wc-pc13-pdf-url">
	
	<div class="wc-pc13-copyright">
		<p>&copy; <?php echo esc_html( date( 'Y' ) ); ?> Configurateur MonHorloge - Développé par la société MonHorloge</p>
		<button type="button" class="wc-pc13-help-btn" aria-label="<?php esc_attr_e( 'Aide et support', 'wc-photo-clock-13' ); ?>">
			<?php esc_html_e( '❓ Poser une question / Signaler un bug', 'wc-photo-clock-13' ); ?>
		</button>
	</div>
	
	<!-- Modal d'aide et support -->
	<div class="wc-pc13-help-modal" style="display: none;">
		<div class="wc-pc13-help-modal-content">
			<span class="wc-pc13-help-modal-close">&times;</span>
			<h3><?php esc_html_e( 'Poser une question ou signaler un bug', 'wc-photo-clock-13' ); ?></h3>
			<form class="wc-pc13-help-form">
				<label for="wc-pc13-help-type">
					<span><?php esc_html_e( 'Type', 'wc-photo-clock-13' ); ?></span>
					<select id="wc-pc13-help-type" name="type" required>
						<option value="question"><?php esc_html_e( 'Question', 'wc-photo-clock-13' ); ?></option>
						<option value="bug"><?php esc_html_e( 'Signaler un bug', 'wc-photo-clock-13' ); ?></option>
					</select>
				</label>
				<label for="wc-pc13-help-email">
					<span><?php esc_html_e( 'Votre email', 'wc-photo-clock-13' ); ?></span>
					<input type="email" id="wc-pc13-help-email" name="email" required placeholder="<?php esc_attr_e( 'votre@email.com', 'wc-photo-clock-13' ); ?>">
				</label>
				<label for="wc-pc13-help-subject">
					<span><?php esc_html_e( 'Sujet', 'wc-photo-clock-13' ); ?></span>
					<input type="text" id="wc-pc13-help-subject" name="subject" required placeholder="<?php esc_attr_e( 'Résumé de votre question ou bug', 'wc-photo-clock-13' ); ?>">
				</label>
				<label for="wc-pc13-help-message">
					<span><?php esc_html_e( 'Message', 'wc-photo-clock-13' ); ?></span>
					<textarea id="wc-pc13-help-message" name="message" rows="6" required placeholder="<?php esc_attr_e( 'Décrivez votre question ou le bug rencontré...', 'wc-photo-clock-13' ); ?>"></textarea>
				</label>
				<div class="wc-pc13-help-modal-actions">
					<button type="button" class="button button-secondary wc-pc13-help-modal-cancel"><?php esc_html_e( 'Annuler', 'wc-photo-clock-13' ); ?></button>
					<button type="submit" class="button button-primary wc-pc13-help-modal-submit"><?php esc_html_e( 'Envoyer', 'wc-photo-clock-13' ); ?></button>
				</div>
				<div class="wc-pc13-help-modal-message" style="display: none;"></div>
			</form>
		</div>
	</div>
</div>

