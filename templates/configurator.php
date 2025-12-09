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
?>
<div class="wc-pc13-configurator" data-product="<?php echo esc_attr( $product_id ); ?>">
	<h3><?php esc_html_e( 'Personnalisez votre horloge 13 photos', 'wc-photo-clock-13' ); ?></h3>

	<div class="wc-pc13-columns">
		<div class="wc-pc13-preview-column">
			<div class="wc-pc13-preview" data-initial-slot-size="110">
				<div class="wc-pc13-clock-face">
					<div class="wc-pc13-ring">
						<?php for ( $i = 1; $i <= 12; $i++ ) : ?>
							<?php
							$angle = ( $i % 12 ) * 30; // 0deg for 12h, 30deg increments.
							?>
							<div class="wc-pc13-slot" data-slot="<?php echo esc_attr( $i ); ?>" style="--angle: <?php echo esc_attr( $angle ); ?>deg;">
								<div class="wc-pc13-slot-inner">
									<span class="wc-pc13-slot-label"><?php echo esc_html( $i ); ?></span>
									<div class="wc-pc13-slot-image"></div>
								</div>
							</div>
						<?php endfor; ?>
					</div>
					<div class="wc-pc13-center" data-slot="center">
						<div class="wc-pc13-center-image"></div>
					</div>
					<div class="wc-pc13-hands">
						<div class="wc-pc13-hand hour"></div>
						<div class="wc-pc13-hand minute"></div>
						<div class="wc-pc13-hand second"></div>
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
			</div>
			<div class="wc-pc13-demo-actions">
				<button type="button" class="button wc-pc13-fill-demo">
					<?php esc_html_e( 'Remplir avec les images de démonstration', 'wc-photo-clock-13' ); ?>
				</button>
				<button type="button" class="button wc-pc13-fill-unsplash">
					<?php esc_html_e( 'Charger des photos aléatoires Unsplash', 'wc-photo-clock-13' ); ?>
				</button>
			</div>
			<div class="wc-pc13-add-to-cart">
				<button type="button" class="button button-primary wc-pc13-add-to-cart-btn">
					<?php echo esc_html( $button_text ?? __( 'Ajouter au panier', 'wc-photo-clock-13' ) ); ?>
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
					<p><strong>💡 <?php esc_html_e( 'Astuce', 'wc-photo-clock-13' ); ?>:</strong> <?php esc_html_e( 'Utilisez les boutons "Remplir avec les images de démonstration" ou "Charger des photos Unsplash" pour tester rapidement le configurateur.', 'wc-photo-clock-13' ); ?></p>
				</div>
			</div>
		</div>

		<div class="wc-pc13-controls-column">
			<div class="wc-pc13-global-settings">
				<label for="wc-pc13-diameter">
					<span><?php esc_html_e( 'Diamètre de l\'horloge', 'wc-photo-clock-13' ); ?></span>
					<select id="wc-pc13-diameter" name="wc_pc13_diameter">
						<option value="30" data-price="49">30 cm - 49€</option>
						<option value="40" data-price="59" selected>40 cm - 59€</option>
						<option value="50" data-price="69">50 cm - 69€</option>
					</select>
					<small class="wc-pc13-diameter-note">
						<?php esc_html_e( 'Impression sur support alu dibond', 'wc-photo-clock-13' ); ?>
						<span class="wc-pc13-info-icon" data-tooltip="<?php echo esc_attr( __( 'L\'alu dibond est un matériau composite constitué de deux feuilles d\'aluminium encadrant une âme en polyéthylène. Ce support rigide et léger offre une excellente résistance aux intempéries et une finition de qualité professionnelle pour vos impressions.', 'wc-photo-clock-13' ) ); ?>">ℹ️</span>
					</small>
				</label>
				<label for="wc-pc13-color"><?php esc_html_e( 'Couleur des aiguilles', 'wc-photo-clock-13' ); ?></label>
				<select id="wc-pc13-color" name="wc_pc13_color">
					<?php foreach ( $hands_colors as $color_value => $color_label ) : ?>
						<option value="<?php echo esc_attr( $color_value ); ?>" <?php selected( strtolower( $default_color ), strtolower( $color_value ) ); ?>>
							<?php echo esc_html( $color_label ); ?>
						</option>
					<?php endforeach; ?>
				</select>
				<label for="wc-pc13-second-hand"><?php esc_html_e( 'Trotteuse (aiguille des secondes)', 'wc-photo-clock-13' ); ?></label>
				<select id="wc-pc13-second-hand" name="wc_pc13_second_hand">
					<option value="red"><?php esc_html_e( 'Rouge', 'wc-photo-clock-13' ); ?></option>
					<option value="black" selected><?php esc_html_e( 'Noir', 'wc-photo-clock-13' ); ?></option>
					<option value="none"><?php esc_html_e( 'Pas de trotteuse', 'wc-photo-clock-13' ); ?></option>
				</select>
				<small class="wc-pc13-silent-note" style="display: block; margin-top: 6px; font-size: 12px; color: #666; font-style: italic;">
					🔇 <?php esc_html_e( 'Horloge silencieuse (pas de tic-tac)', 'wc-photo-clock-13' ); ?>
				</small>
				<div class="wc-pc13-center-panel">
					<div class="wc-pc13-center-actions">
						<button type="button" class="button button-secondary wc-pc13-select-center">
							<?php esc_html_e( 'Remplacer l’image centrale…', 'wc-photo-clock-13' ); ?>
						</button>
						<button type="button" class="button wc-pc13-remove-center" disabled>
							<?php esc_html_e( 'Retirer l’image centrale', 'wc-photo-clock-13' ); ?>
						</button>
					</div>
					<h5><?php esc_html_e( 'Visuel central', 'wc-photo-clock-13' ); ?></h5>
					<label for="wc-pc13-center-size">
						<span><?php esc_html_e( 'Diamètre du visuel central', 'wc-photo-clock-13' ); ?></span>
						<input type="range" id="wc-pc13-center-size" name="wc_pc13_center_size" min="120" max="520" step="1" value="180" data-center-size>
					</label>
				</div>
				<label class="wc-pc13-toggle">
					<input type="checkbox" id="wc-pc13-show-numbers" name="wc_pc13_show_numbers" value="1">
					<span><?php esc_html_e( 'Afficher les chiffres des heures', 'wc-photo-clock-13' ); ?></span>
				</label>
				<div class="wc-pc13-numbers-fields">
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
						<input type="range" id="wc-pc13-number-distance" name="wc_pc13_number_distance" min="0" max="400" step="1" value="0">
					</label>
				</div>
					<label for="wc-pc13-slot-size"><?php esc_html_e( 'Taille des photos périphériques', 'wc-photo-clock-13' ); ?></label>
					<input type="range" id="wc-pc13-slot-size" name="wc_pc13_slot_size" min="50" max="160" step="1" value="110">
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
						<input type="range" min="0.5" max="2.5" step="0.01" value="1" data-zoom>
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
	</div>
</div>

