<?php
/**
 * Gestion de l’affichage des données dans le panier et la commande.
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_PC13_Cart {

	/**
	 * Instance.
	 *
	 * @var WC_PC13_Cart|null
	 */
	protected static $instance = null;

	/**
	 * Singleton.
	 *
	 * @return WC_PC13_Cart
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Constructeur.
	 */
	private function __construct() {
		add_action( 'woocommerce_before_order_itemmeta', array( $this, 'render_order_preview' ), 10, 3 );
		add_action( 'woocommerce_email_after_order_table', array( $this, 'render_email_summary' ), 10, 4 );
		add_filter( 'woocommerce_hidden_order_itemmeta', array( $this, 'hide_config_meta' ), 10, 1 );
		add_filter( 'woocommerce_order_item_display_meta_key', array( $this, 'hide_config_meta_key' ), 10, 1 );
		add_action( 'wp_ajax_wc_pc13_generate_order_pdf', array( $this, 'generate_order_pdf' ) );
	}

	/**
	 * Convertit un code couleur hexadécimal en nom lisible.
	 *
	 * @param string $color_code Code couleur hexadécimal.
	 * @return string Nom de la couleur ou code si non trouvé.
	 */
	private function get_color_name( $color_code ) {
		$color_code = strtolower( trim( $color_code ) );

		$color_map = array(
			'#111111' => __( 'Noir', 'wc-photo-clock-13' ),
			'#ffffff' => __( 'Blanc', 'wc-photo-clock-13' ),
			'#777777' => __( 'Gris', 'wc-photo-clock-13' ),
			'#cc1f1a' => __( 'Rouge', 'wc-photo-clock-13' ),
		);

		if ( substr( $color_code, 0, 1 ) !== '#' ) {
			$color_code = '#' . $color_code;
		}

		return isset( $color_map[ $color_code ] ) ? $color_map[ $color_code ] : $color_code;
	}

	/**
	 * Génère un PDF directement depuis un canvas GD sans fichier intermédiaire.
	 *
	 * @param resource $canvas Ressource GD du canvas.
	 * @param string   $pdf_path Chemin de sortie du PDF.
	 * @param int      $width_pt Largeur en points (1/72 inch).
	 * @param int      $height_pt Hauteur en points.
	 * @return bool
	 */
	private function generate_pdf_from_canvas( $canvas, $pdf_path, $width_pt, $height_pt ) {
		if ( ! $canvas ) {
			return false;
		}
		
		// Vérifier que c'est une ressource GD valide (PHP < 8) ou un objet GdImage (PHP >= 8)
		if ( ! is_resource( $canvas ) && ! ( is_object( $canvas ) && $canvas instanceof \GdImage ) ) {
			return false;
		}

		$img_w = imagesx( $canvas );
		$img_h = imagesy( $canvas );

		if ( $img_w <= 0 || $img_h <= 0 ) {
			return false;
		}

		// Capturer le JPEG en mémoire depuis le canvas
		ob_start();
		imagejpeg( $canvas, null, 98 );
		$jpeg_data = ob_get_clean();

		if ( false === $jpeg_data || empty( $jpeg_data ) ) {
			return false;
		}

		// Ajuster les dimensions cible si non fournies
		if ( $width_pt <= 0 || $height_pt <= 0 ) {
			$width_pt  = max( $img_w, 1 );
			$height_pt = max( $img_h, 1 );
		}

		$objects   = array();
		$offsets   = array();
		$buffer    = "%PDF-1.4\n";

		// 1. Catalog
		$offsets[] = strlen( $buffer );
		$buffer   .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

		// 2. Pages
		$offsets[] = strlen( $buffer );
		$buffer   .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

		// 3. Page
		$offsets[] = strlen( $buffer );
		$buffer   .= "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 {$width_pt} {$height_pt}] /Contents 5 0 R >>\nendobj\n";

		// 4. Image XObject
		$length_img = strlen( $jpeg_data );
		$offsets[]  = strlen( $buffer );
		$buffer    .= "4 0 obj\n<< /Type /XObject /Subtype /Image /Width {$img_w} /Height {$img_h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {$length_img} >>\nstream\n";
		$buffer    .= $jpeg_data . "\nendstream\nendobj\n";

		// 5. Page content stream
		$content = "q {$width_pt} 0 0 {$height_pt} 0 0 cm /Im0 Do Q";
		$len_ct  = strlen( $content );
		$offsets[] = strlen( $buffer );
		$buffer   .= "5 0 obj\n<< /Length {$len_ct} >>\nstream\n{$content}\nendstream\nendobj\n";

		// xref
		$xref_pos = strlen( $buffer );
		$buffer  .= "xref\n0 6\n0000000000 65535 f \n";
		foreach ( $offsets as $off ) {
			$buffer .= sprintf( "%010d 00000 n \n", $off );
		}

		// trailer
		$buffer .= "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{$xref_pos}\n%%EOF";

		return false !== file_put_contents( $pdf_path, $buffer );
	}

	/**
	 * Génère un PDF minimal avec une seule image JPEG sans dépendre d'Imagick.
	 *
	 * @param string $jpeg_path Chemin du JPEG source.
	 * @param string $pdf_path  Chemin de sortie du PDF.
	 * @param int    $width_pt  Largeur en points (1/72 inch).
	 * @param int    $height_pt Hauteur en points.
	 * @return bool
	 */
	private function generate_pdf_from_jpeg( $jpeg_path, $pdf_path, $width_pt, $height_pt ) {
		if ( ! file_exists( $jpeg_path ) ) {
			return false;
		}

		$jpeg_data = file_get_contents( $jpeg_path );
		if ( false === $jpeg_data ) {
			return false;
		}

		// Récupérer dimensions du JPEG pour ajuster l'échelle
		$image_info = getimagesize( $jpeg_path );
		if ( empty( $image_info[0] ) || empty( $image_info[1] ) ) {
			return false;
		}
		$img_w = (int) $image_info[0];
		$img_h = (int) $image_info[1];

		// Ajuster les dimensions cible si non fournies
		if ( $width_pt <= 0 || $height_pt <= 0 ) {
			$width_pt  = max( $img_w, 1 );
			$height_pt = max( $img_h, 1 );
		}

		$objects   = array();
		$offsets   = array();
		$buffer    = "%PDF-1.4\n";

		// 1. Catalog
		$offsets[] = strlen( $buffer );
		$buffer   .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

		// 2. Pages
		$offsets[] = strlen( $buffer );
		$buffer   .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

		// 3. Page
		$offsets[] = strlen( $buffer );
		$buffer   .= "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 {$width_pt} {$height_pt}] /Contents 5 0 R >>\nendobj\n";

		// 4. Image XObject
		$length_img = strlen( $jpeg_data );
		$offsets[]  = strlen( $buffer );
		$buffer    .= "4 0 obj\n<< /Type /XObject /Subtype /Image /Width {$img_w} /Height {$img_h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {$length_img} >>\nstream\n";
		$buffer    .= $jpeg_data . "\nendstream\nendobj\n";

		// 5. Page content stream
		$content = "q {$width_pt} 0 0 {$height_pt} 0 0 cm /Im0 Do Q";
		$len_ct  = strlen( $content );
		$offsets[] = strlen( $buffer );
		$buffer   .= "5 0 obj\n<< /Length {$len_ct} >>\nstream\n{$content}\nendstream\nendobj\n";

		// xref
		$xref_pos = strlen( $buffer );
		$buffer  .= "xref\n0 6\n0000000000 65535 f \n";
		foreach ( $offsets as $off ) {
			$buffer .= sprintf( "%010d 00000 n \n", $off );
		}

		// trailer
		$buffer .= "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{$xref_pos}\n%%EOF";

		return false !== file_put_contents( $pdf_path, $buffer );
	}

	/**
	 * Affiche un résumé dans l’admin commande.
	 *
	 * @param int            $item_id ID ligne.
	 * @param WC_Order_Item  $item Item.
	 * @param WC_Order       $order Commande.
	 */
	public function render_order_preview( $item_id, $item, $order ) {
		unset( $order );
		$config = $item->get_meta( 'wc_pc13_config', true );
		if ( ! $config ) {
			return;
		}

		$data = json_decode( $config, true );
		if ( empty( $data ) ) {
			return;
		}

		$unique_id = 'wc-pc13-debug-' . $item_id;
		$config_formatted = wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		echo '<div class="wc-pc13-order-preview" style="margin:15px 0;padding:15px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;">';
		echo '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
		echo '<h3 style="margin:0;font-size:16px;">' . esc_html__( 'Configuration Horloge 13 Photos', 'wc-photo-clock-13' ) . '</h3>';
		echo '<button type="button" class="button button-small wc-pc13-debug-btn" data-modal-id="' . esc_attr( $unique_id ) . '" style="margin-left:10px;">' . esc_html__( 'Voir le debug', 'wc-photo-clock-13' ) . '</button>';
		echo '</div>';

		echo '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-bottom:15px;">';
		
		// Afficher le diamètre avec prix et support
		if ( ! empty( $data['diameter'] ) ) {
			$diameter = absint( $data['diameter'] );
			$price = isset( $data['diameter_price'] ) ? floatval( $data['diameter_price'] ) : 59;
			echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Diamètre', 'wc-photo-clock-13' ) . ':</strong><br><span style="color:#666;">' . esc_html( $diameter ) . ' cm - ' . number_format_i18n( $price, 0 ) . '€</span><br><small style="color:#999;font-size:11px;">' . esc_html__( 'Impression sur support alu dibond', 'wc-photo-clock-13' ) . '</small></div>';
		}
		
		if ( ! empty( $data['hands'] ) ) {
			$hands_label = ucfirst( sanitize_text_field( $data['hands'] ) );
			echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Style d\'aiguilles', 'wc-photo-clock-13' ) . ':</strong><br><span style="color:#666;">' . esc_html( $hands_label ) . '</span></div>';
		}
		if ( ! empty( $data['color'] ) ) {
			$color_code = sanitize_hex_color( $data['color'] );
			$color_name = $this->get_color_name( $color_code );
			echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Couleur des aiguilles', 'wc-photo-clock-13' ) . ':</strong><br><span style="display:inline-block;width:20px;height:20px;background:' . esc_attr( $color_code ) . ';border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:5px;"></span><span style="color:#666;">' . esc_html( $color_name ) . '</span></div>';
		}
		if ( isset( $data['ring_size'] ) ) {
			echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Taille photos périphériques', 'wc-photo-clock-13' ) . ':</strong><br><span style="color:#666;">' . esc_html( absint( $data['ring_size'] ) ) . ' px</span></div>';
		}
		if ( array_key_exists( 'show_numbers', $data ) ) {
			$has_numbers = wc_string_to_bool( $data['show_numbers'] );
			echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Chiffres des heures', 'wc-photo-clock-13' ) . ':</strong><br><span style="color:#666;">' . esc_html( $has_numbers ? __( 'Oui', 'wc-photo-clock-13' ) : __( 'Non', 'wc-photo-clock-13' ) ) . '</span></div>';
			if ( $has_numbers && ! empty( $data['numbers'] ) && is_array( $data['numbers'] ) ) {
				if ( ! empty( $data['numbers']['color'] ) ) {
					$num_color = sanitize_hex_color( $data['numbers']['color'] );
					echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Couleur des chiffres', 'wc-photo-clock-13' ) . ':</strong><br><span style="display:inline-block;width:20px;height:20px;background:' . esc_attr( $num_color ) . ';border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:5px;"></span><span style="color:#666;">' . esc_html( $num_color ) . '</span></div>';
				}
				if ( isset( $data['numbers']['size'] ) ) {
					echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Taille des chiffres', 'wc-photo-clock-13' ) . ':</strong><br><span style="color:#666;">' . esc_html( absint( $data['numbers']['size'] ) ) . ' px</span></div>';
				}
				$distance_value = null;
				if ( isset( $data['numbers']['distance'] ) ) {
					$distance_value = absint( $data['numbers']['distance'] );
				} elseif ( isset( $data['numbers']['offset'] ) ) {
					$distance_value = absint( $data['numbers']['offset'] );
				}

				if ( null !== $distance_value ) {
					echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Distance depuis le centre', 'wc-photo-clock-13' ) . ':</strong><br><span style="color:#666;">' . esc_html( $distance_value ) . ' px</span></div>';
				}
			}
		}
		echo '</div>'; // Fin de la grille

		// Boutons de téléchargement
		echo '<div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;">';
		
		$preview_meta = $item->get_meta( 'wc_pc13_preview', true );
		$preview_url = '';
		if ( $preview_meta ) {
			$preview_data = json_decode( $preview_meta, true );
			if ( ! empty( $preview_data['url'] ) ) {
				$preview_url = esc_url( $preview_data['url'] );
			} elseif ( ! empty( $preview_data['id'] ) ) {
				$preview_url = esc_url( wp_get_attachment_url( absint( $preview_data['id'] ) ) );
			}
			if ( $preview_url ) {
				echo '<a class="button" href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger l’aperçu JPEG', 'wc-photo-clock-13' ) . '</a>';
			}
		}

		// Toujours afficher le bouton PDF - utiliser le PDF sauvegardé ou générer à la volée
		$pdf_url = '';
		$pdf_meta = $item->get_meta( 'wc_pc13_pdf', true );
		if ( $pdf_meta ) {
			$pdf_data = json_decode( $pdf_meta, true );
			if ( ! empty( $pdf_data['url'] ) ) {
				$pdf_url = esc_url( $pdf_data['url'] );
			} elseif ( ! empty( $pdf_data['id'] ) ) {
				$pdf_url = esc_url( wp_get_attachment_url( absint( $pdf_data['id'] ) ) );
			}
		}
		
		// Afficher le bouton PDF - générer à la volée si nécessaire
		if ( $pdf_url && $pdf_meta ) {
			// PDF déjà sauvegardé
			echo '<a class="button button-primary" href="' . esc_url( $pdf_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger le visuel HD PDF', 'wc-photo-clock-13' ) . '</a>';
		} elseif ( $preview_url ) {
			// Générer le PDF à partir du preview - toujours utiliser la fonction de génération
			$generate_pdf_url = wp_nonce_url(
				admin_url( 'admin-ajax.php?action=wc_pc13_generate_order_pdf&item_id=' . absint( $item_id ) ),
				'wc_pc13_generate_pdf_' . absint( $item_id ),
				'nonce'
			);
			echo '<a class="button button-primary wc-pc13-generate-pdf-btn" href="' . esc_url( $generate_pdf_url ) . '" data-item-id="' . absint( $item_id ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger le visuel HD PDF', 'wc-photo-clock-13' ) . '</a>';
		}
		
		echo '</div>';

		$center = isset( $data['center'] ) && is_array( $data['center'] ) ? $data['center'] : array();
		$slots  = isset( $data['slots'] ) && is_array( $data['slots'] ) ? $data['slots'] : array();

		echo '<table class="wc-pc13-order-images" style="margin-top:10px;width:100%;max-width:520px;border-collapse:collapse;">';
		echo '<thead><tr><th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 4px;">' . esc_html__( 'Emplacement', 'wc-photo-clock-13' ) . '</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 4px;">' . esc_html__( 'Image', 'wc-photo-clock-13' ) . '</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 4px;">' . esc_html__( 'Réglages', 'wc-photo-clock-13' ) . '</th></tr></thead><tbody>';

		$center_url = '';
		if ( ! empty( $center['attachment_id'] ) ) {
			$center_url = wp_get_attachment_url( absint( $center['attachment_id'] ) );
		}
		if ( ! $center_url && ! empty( $center['image_url'] ) ) {
			$center_url = esc_url( $center['image_url'] );
		}

		$center_details = array();
		if ( isset( $center['size'] ) ) {
			$center_details[] = sprintf( __( 'Diamètre : %d px', 'wc-photo-clock-13' ), absint( $center['size'] ) );
		}
		if ( isset( $center['scale'] ) ) {
			$center_details[] = sprintf( __( 'Zoom : ×%s', 'wc-photo-clock-13' ), number_format_i18n( floatval( $center['scale'] ), 2 ) );
		}
		if ( isset( $center['x'] ) || isset( $center['y'] ) ) {
			$center_details[] = sprintf( __( 'Offset : %s%% / %s%%', 'wc-photo-clock-13' ), number_format_i18n( floatval( $center['x'] ?? 0 ), 0 ), number_format_i18n( floatval( $center['y'] ?? 0 ), 0 ) );
		}

		echo '<tr><td style="padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle;">' . esc_html__( 'Visuel central', 'wc-photo-clock-13' ) . '</td><td style="padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle;">';
		if ( $center_url ) {
			$center_thumb = '';
			if ( ! empty( $center['attachment_id'] ) ) {
				$center_thumb = wp_get_attachment_image( absint( $center['attachment_id'] ), array( 80, 80 ), false, array( 'style' => 'max-width:80px;max-height:80px;border-radius:4px;margin-right:8px;vertical-align:middle;' ) );
			} elseif ( $center_url ) {
				$center_thumb = '<img src="' . esc_url( $center_url ) . '" alt="' . esc_attr__( 'Visuel central', 'wc-photo-clock-13' ) . '" style="max-width:80px;max-height:80px;border-radius:4px;margin-right:8px;vertical-align:middle;object-fit:cover;" />';
			}
			echo '<div style="display:flex;align-items:center;gap:8px;">';
			if ( $center_thumb ) {
				echo '<a href="' . esc_url( $center_url ) . '" target="_blank" rel="noopener noreferrer" style="display:inline-block;">' . $center_thumb . '</a>';
			}
			echo '<a class="button" href="' . esc_url( $center_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger', 'wc-photo-clock-13' ) . '</a>';
			echo '</div>';
		} else {
			echo esc_html__( 'Aucune image', 'wc-photo-clock-13' );
		}
		echo '</td><td style="padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle;">' . esc_html( implode( ' | ', array_filter( $center_details ) ) ) . '</td></tr>';

		for ( $i = 1; $i <= 12; $i++ ) {
			$slot_data = isset( $slots[ $i ] ) ? $slots[ $i ] : array();
			$slot_url  = '';
			if ( ! empty( $slot_data['attachment_id'] ) ) {
				$slot_url = wp_get_attachment_url( absint( $slot_data['attachment_id'] ) );
			}
			if ( ! $slot_url && ! empty( $slot_data['image_url'] ) ) {
				$slot_url = esc_url( $slot_data['image_url'] );
			}

			$details = array();
			if ( isset( $slot_data['scale'] ) ) {
				$details[] = sprintf( __( 'Zoom : ×%s', 'wc-photo-clock-13' ), number_format_i18n( floatval( $slot_data['scale'] ), 2 ) );
			}
			$details[] = sprintf( __( 'Offset : %s%% / %s%%', 'wc-photo-clock-13' ), number_format_i18n( floatval( $slot_data['x'] ?? 0 ), 0 ), number_format_i18n( floatval( $slot_data['y'] ?? 0 ), 0 ) );

			echo '<tr><td style="padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle;">' . sprintf( esc_html__( 'Photo %d', 'wc-photo-clock-13' ), $i ) . '</td><td style="padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle;">';
			if ( $slot_url ) {
				$slot_thumb = '';
				if ( ! empty( $slot_data['attachment_id'] ) ) {
					$slot_thumb = wp_get_attachment_image( absint( $slot_data['attachment_id'] ), array( 80, 80 ), false, array( 'style' => 'max-width:80px;max-height:80px;border-radius:4px;margin-right:8px;vertical-align:middle;' ) );
				} elseif ( $slot_url ) {
					$slot_thumb = '<img src="' . esc_url( $slot_url ) . '" alt="' . sprintf( esc_attr__( 'Photo %d', 'wc-photo-clock-13' ), $i ) . '" style="max-width:80px;max-height:80px;border-radius:4px;margin-right:8px;vertical-align:middle;object-fit:cover;" />';
				}
				echo '<div style="display:flex;align-items:center;gap:8px;">';
				if ( $slot_thumb ) {
					echo '<a href="' . esc_url( $slot_url ) . '" target="_blank" rel="noopener noreferrer" style="display:inline-block;">' . $slot_thumb . '</a>';
				}
				echo '<a class="button" href="' . esc_url( $slot_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger', 'wc-photo-clock-13' ) . '</a>';
				echo '</div>';
			} else {
				echo esc_html__( 'Aucune image', 'wc-photo-clock-13' );
			}
			echo '</td><td style="padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle;">' . esc_html( implode( ' | ', array_filter( $details ) ) ) . '</td></tr>';
		}

		echo '</tbody></table>';

		// Modal pour le debug JSON
		echo '<div id="' . esc_attr( $unique_id ) . '" class="wc-pc13-debug-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100000;overflow:auto;">';
		echo '<div style="position:relative;max-width:900px;margin:50px auto;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">';
		echo '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px;border-bottom:1px solid #ddd;">';
		echo '<h2 style="margin:0;font-size:18px;">' . esc_html__( 'Données de configuration (Debug)', 'wc-photo-clock-13' ) . '</h2>';
		echo '<button type="button" class="button wc-pc13-close-modal" data-modal-id="' . esc_attr( $unique_id ) . '" style="margin-left:10px;">' . esc_html__( 'Fermer', 'wc-photo-clock-13' ) . '</button>';
		echo '</div>';
		echo '<div style="padding:20px;max-height:70vh;overflow:auto;">';
		echo '<pre style="margin:0;padding:15px;background:#2c3e50;color:#ecf0f1;font-family:Monaco,Consolas,\'Courier New\',monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;border-radius:4px;overflow-x:auto;">';
		echo esc_html( $config_formatted );
		echo '</pre>';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		// Script pour gérer le modal
		?>
		<script>
		(function() {
			var modalId = '<?php echo esc_js( $unique_id ); ?>';
			var modal = document.getElementById(modalId);
			if (!modal) return;

			// Ouvrir le modal
			var openBtn = document.querySelector('[data-modal-id="' + modalId + '"].wc-pc13-debug-btn');
			if (openBtn) {
				openBtn.addEventListener('click', function(e) {
					e.preventDefault();
					modal.style.display = 'block';
					document.body.style.overflow = 'hidden';
				});
			}

			// Fermer le modal
			var closeBtn = modal.querySelector('.wc-pc13-close-modal');
			if (closeBtn) {
				closeBtn.addEventListener('click', function(e) {
					e.preventDefault();
					modal.style.display = 'none';
					document.body.style.overflow = '';
				});
			}

			// Fermer en cliquant en dehors
			modal.addEventListener('click', function(e) {
				if (e.target === modal) {
					modal.style.display = 'none';
					document.body.style.overflow = '';
				}
			});

			// Fermer avec la touche Escape
			document.addEventListener('keydown', function(e) {
				if (e.key === 'Escape' && modal.style.display === 'block') {
					modal.style.display = 'none';
					document.body.style.overflow = '';
				}
			});
		})();
		</script>
		<?php

		echo '</div>';
	}

	/**
	 * Construit un canvas haute résolution à partir de la configuration et des images sources.
	 *
	 * @param array $config Configuration complète.
	 * @param int   $base_size Taille de base en pixels.
	 * @return resource|false Ressource GD ou false en cas d'erreur.
	 */
	private function build_high_res_canvas( $config, $base_size = 360, $draw_hands = true ) {
		// Calculer la taille de sortie (comme côté frontend: Math.max(4096, Math.ceil(baseSize * 4)))
		$output_size = max( 4096, (int) ceil( $base_size * 4 ) );
		$scale_factor = $output_size / $base_size;
		
		// Créer le canvas GD
		if ( ! function_exists( 'imagecreatetruecolor' ) ) {
			return false;
		}
		
		$canvas = imagecreatetruecolor( $output_size, $output_size );
		if ( ! $canvas ) {
			return false;
		}
		
		// Activer la transparence pour le canvas
		imagealphablending( $canvas, false );
		imagesavealpha( $canvas, true );
		
		// Fond blanc
		$white = imagecolorallocate( $canvas, 255, 255, 255 );
		imagefill( $canvas, 0, 0, $white );
		
		// Réactiver le blending pour les dessins suivants
		imagealphablending( $canvas, true );
		
		$center_x = $output_size / 2;
		$center_y = $output_size / 2;
		
		    // Couleur de fond de l'horloge
    $bg_color = isset( $config['background_color'] ) ? $config['background_color'] : '#ffffff';
		$bg_rgb = $this->hex_to_rgb( $bg_color );
		$bg_gd = imagecolorallocate( $canvas, $bg_rgb['r'], $bg_rgb['g'], $bg_rgb['b'] );
		
		// Dessiner le cercle de fond
		imagefilledellipse( $canvas, $center_x, $center_y, $output_size, $output_size, $bg_gd );
		
		// Récupérer les paramètres
		$ring_size = isset( $config['ring_size'] ) ? absint( $config['ring_size'] ) : 110;
		$slot_size = $ring_size * $scale_factor;
		$ring_radius_screen = max( ( $base_size / 2 ) - ( $ring_size / 2 ) - 35, 50 );
		$ring_radius = $ring_radius_screen * $scale_factor;
		
		$center_size_state = isset( $config['center']['size'] ) && $config['center']['size'] > 0 
			? absint( $config['center']['size'] ) 
			: 120; // CENTER_MIN_SIZE
		$center_size = $center_size_state * $scale_factor;
		
		$numbers_distance = isset( $config['numbers']['distance'] ) && $config['numbers']['distance'] >= 0
			? absint( $config['numbers']['distance'] )
			: 0;
		$numbers_radius = $numbers_distance * $scale_factor;
		
		// Charger et dessiner les slots périphériques (seulement si activés)
		$show_slots = true; // FORCE DEBUG
		$slots = isset( $config['slots'] ) && is_array( $config['slots'] ) ? $config['slots'] : array();
		
		// DEBUG TRACE
		$black = imagecolorallocate( $canvas, 0, 0, 0 );
		imagestring( $canvas, 5, 50, 50, "Force ShowSlots=TRUE. Count=" . count($slots), $black );

		if ( $show_slots ) {
			for ( $i = 1; $i <= 12; $i++ ) {
			$slot = isset( $slots[ $i ] ) ? $slots[ $i ] : array();
			
			// Récupérer l'URL de l'image source (priorité à image_url pour HD, pas image_url_display qui est le thumbnail)
			$image_url = '';
			if ( ! empty( $slot['image_url'] ) ) {
				$image_url = $slot['image_url'];
			} elseif ( ! empty( $slot['attachment_id'] ) ) {
				// Utiliser l'image originale en haute résolution, pas le thumbnail
				$attachment_id = absint( $slot['attachment_id'] );
				$image_url = wp_get_attachment_image_url( $attachment_id, 'full' );
				if ( ! $image_url ) {
					$image_url = wp_get_attachment_url( $attachment_id );
				}
			}
			
			if ( empty( $image_url ) ) {
				continue;
			}
			
			// Charger l'image
			$slot_image = $this->load_image_resource( $image_url, isset( $slot['attachment_id'] ) ? absint( $slot['attachment_id'] ) : 0 );
			
			// DEBUG URL
			imagestring( $canvas, 2, 50, 70 + ($i*20), "Slot $i: " . substr($image_url, 0, 30) . "...", $black );

			if ( ! $slot_image ) {
				// DEBUG: Dessiner un cercle rouge si l'image ne charge pas
				$red = imagecolorallocate( $canvas, 255, 0, 0 );
				imagefilledellipse( $canvas, $slot_center_x, $slot_center_y, $slot_size, $slot_size, $red );
				// Dessiner du texte debug
				$black = imagecolorallocate( $canvas, 0, 0, 0 );
				imagestring( $canvas, 5, $slot_center_x - 20, $slot_center_y, "Err Img", $black );
				continue;
			}
			
			// Draw green marker for success
			$green = imagecolorallocate( $canvas, 0, 255, 0 );
			imagefilledellipse( $canvas, $slot_center_x, $slot_center_y, 50, 50, $green );
			
			// Calculer l'angle pour positionner le slot 12 en haut
			$base_angle = ( $i == 12 ? 0 : $i ) * 30;
			$angle_deg = ( $base_angle + 180 ) % 360;
			$angle_rad = deg2rad( $angle_deg );
			$slot_center_x = $center_x + sin( $angle_rad ) * $ring_radius;
			$slot_center_y = $center_y - cos( $angle_rad ) * $ring_radius;
			
			// Récupérer les transformations
			$scale = isset( $slot['scale'] ) ? floatval( $slot['scale'] ) : 1.0;
			$x_offset = isset( $slot['x'] ) ? floatval( $slot['x'] ) : 0.0;
			$y_offset = isset( $slot['y'] ) ? floatval( $slot['y'] ) : 0.0;
			
			// Dessiner l'ombre portée si activée
			if ( isset( $config['slot_shadow']['enabled'] ) && $config['slot_shadow']['enabled'] ) {
				$shadow_radius = $slot_size / 2;
				$shadow_x = $slot_center_x + 4 * $scale_factor;
				$shadow_y = $slot_center_y + 4 * $scale_factor;
				$shadow_color = imagecolorallocatealpha( $canvas, 0, 0, 0, 64 ); // rgba(0,0,0,0.25)
				imagefilledellipse( $canvas, $shadow_x, $shadow_y, $slot_size, $slot_size, $shadow_color );
			}
			
			// Dessiner l'image circulaire
			$this->draw_circular_image_gd( $canvas, $slot_center_x, $slot_center_y, $slot_size, $slot_image, array(
				'scale' => $scale,
				'x'     => $x_offset,
				'y'     => $y_offset,
			), $scale_factor );
			
			// Dessiner la bordure si activée
			if ( isset( $config['slot_border']['enabled'] ) && $config['slot_border']['enabled'] ) {
				$border_width = isset( $config['slot_border']['width'] ) ? absint( $config['slot_border']['width'] ) : 2;
				$border_color_hex = isset( $config['slot_border']['color'] ) ? $config['slot_border']['color'] : '#000000';
				$border_rgb = $this->hex_to_rgb( $border_color_hex );
				$border_gd = imagecolorallocate( $canvas, $border_rgb['r'], $border_rgb['g'], $border_rgb['b'] );
				imagesetthickness( $canvas, $border_width * $scale_factor );
				imageellipse( $canvas, $slot_center_x, $slot_center_y, $slot_size, $slot_size, $border_gd );
			}
			
			imagedestroy( $slot_image );
			}
		}
		
		// Charger et dessiner l'image centrale
		$center = isset( $config['center'] ) && is_array( $config['center'] ) ? $config['center'] : array();
		if ( ! empty( $center['image_url'] ) || ! empty( $center['attachment_id'] ) ) {
			$center_image_url = '';
			if ( ! empty( $center['image_url'] ) ) {
				$center_image_url = $center['image_url'];
			} elseif ( ! empty( $center['attachment_id'] ) ) {
				// Utiliser l'image originale en haute résolution
				$attachment_id = absint( $center['attachment_id'] );
				$center_image_url = wp_get_attachment_image_url( $attachment_id, 'full' );
				if ( ! $center_image_url ) {
					$center_image_url = wp_get_attachment_url( $attachment_id );
				}
			}
			
			if ( $center_image_url ) {
				$center_image = $this->load_image_resource( $center_image_url, isset( $center['attachment_id'] ) ? absint( $center['attachment_id'] ) : 0 );
				if ( $center_image ) {
					$center_scale = isset( $center['scale'] ) ? floatval( $center['scale'] ) : 1.0;
					$center_x_offset = isset( $center['x'] ) ? floatval( $center['x'] ) : 0.0;
					$center_y_offset = isset( $center['y'] ) ? floatval( $center['y'] ) : 0.0;
					
					$this->draw_circular_image_gd( $canvas, $center_x, $center_y, $center_size, $center_image, array(
						'scale' => $center_scale,
						'x'     => $center_x_offset,
						'y'     => $center_y_offset,
					), $scale_factor );
					
					imagedestroy( $center_image );
				} else {
					// DEBUG: Centre rouge
					$red = imagecolorallocate( $canvas, 255, 0, 0 );
					imagefilledellipse( $canvas, $center_x, $center_y, $center_size, $center_size, $red );
					$black = imagecolorallocate( $canvas, 0, 0, 0 );
					imagestring( $canvas, 5, $center_x - 20, $center_y, "Err Ctr", $black );
				}
			}
		}
		
		// Dessiner les chiffres si activés
		$show_numbers = true;
		if ( $show_numbers || (isset( $config['show_numbers'] ) && wc_string_to_bool( $config['show_numbers'] ) ) ) {
			imagestring( $canvas, 5, 50, 400, "Drawing Numbers...", $black );
			$number_type = isset( $config['numbers']['number_type'] ) ? $config['numbers']['number_type'] : ( isset( $config['number_type'] ) ? $config['number_type'] : 'arabic' );
			$intermediate_points = isset( $config['numbers']['intermediate_points'] ) ? $config['numbers']['intermediate_points'] : ( isset( $config['intermediate_points'] ) ? $config['intermediate_points'] : 'without' );
			$number_size = isset( $config['numbers']['size'] ) ? max( 12, absint( $config['numbers']['size'] ) ) : 32;
			$font_size = $number_size * $scale_factor;
			$number_color_hex = isset( $config['numbers']['color'] ) ? $config['numbers']['color'] : '#222222';
			$number_rgb = $this->hex_to_rgb( $number_color_hex );
			$number_color_gd = imagecolorallocate( $canvas, $number_rgb['r'], $number_rgb['g'], $number_rgb['b'] );
			
			$shadow_enabled = isset( $config['numbers']['shadow']['enabled'] ) && $config['numbers']['shadow']['enabled'];
			$shadow_intensity = $shadow_enabled ? ( isset( $config['numbers']['shadow']['intensity'] ) ? absint( $config['numbers']['shadow']['intensity'] ) : 5 ) : 0;
			$glow_enabled = isset( $config['numbers']['glow']['enabled'] ) && $config['numbers']['glow']['enabled'];
			$glow_intensity = $glow_enabled ? ( isset( $config['numbers']['glow']['intensity'] ) ? absint( $config['numbers']['glow']['intensity'] ) : 10 ) : 0;
			
			// Utiliser imagettftext si disponible, sinon imagestring
			$use_ttf = function_exists( 'imagettftext' );
			$font_path = '';
			if ( $use_ttf ) {
				// Chercher une police système
				$system_fonts = array(
					'/System/Library/Fonts/Helvetica.ttc',
					'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
					'/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
					'/Windows/Fonts/arial.ttf',
				);
				foreach ( $system_fonts as $font ) {
					if ( file_exists( $font ) ) {
						$font_path = $font;
						break;
					}
				}
				// Si aucune police système trouvée, utiliser imagestring
				if ( empty( $font_path ) ) {
					$use_ttf = false;
				}
			}
			
			for ( $i = 1; $i <= 12; $i++ ) {
				$angle_deg = ( $i === 12 ? 0 : $i ) * 30;
				$angle_rad = deg2rad( $angle_deg );
				$number_x = $center_x + sin( $angle_rad ) * $numbers_radius;
				$number_y = $center_y - cos( $angle_rad ) * $numbers_radius;
				
				$display_text = $this->get_dial_display_text( $i, $number_type, $intermediate_points );
				
				// Calculer la taille du texte pour le centrer correctement
				$text_box = $use_ttf && $font_path 
					? imagettfbbox( $font_size, 0, $font_path, $display_text )
					: array( 0, 0, strlen( $display_text ) * imagefontwidth( 5 ), imagefontheight( 5 ) );
				$text_width = $use_ttf && $font_path 
					? abs( $text_box[4] - $text_box[0] )
					: strlen( $display_text ) * imagefontwidth( 5 );
				$text_height = $use_ttf && $font_path
					? abs( $text_box[5] - $text_box[1] )
					: imagefontheight( 5 );
				$text_x = $number_x - ( $text_width / 2 );
				$text_y = $number_y + ( $text_height / 2 );
				
				// Dessiner le halo lumineux d'abord (derrière)
				if ( $glow_enabled && $glow_intensity > 0 ) {
					// Simuler le glow avec plusieurs passes
					for ( $j = 0; $j < 3; $j++ ) {
						$glow_alpha = 30 - ( $j * 10 );
						$glow_color = imagecolorallocatealpha( $canvas, $number_rgb['r'], $number_rgb['g'], $number_rgb['b'], $glow_alpha );
						if ( $use_ttf && $font_path ) {
							imagettftext( $canvas, $font_size, 0, $text_x, $text_y, $glow_color, $font_path, $display_text );
						} else {
							imagestring( $canvas, 5, $text_x, $text_y - $text_height, $display_text, $glow_color );
						}
					}
				}
				
				// Dessiner l'ombre portée
				if ( $shadow_enabled && $shadow_intensity > 0 ) {
					$shadow_offset = $shadow_intensity * 0.5 * $scale_factor;
					$shadow_alpha = 77; // 0.3 * 255
					$shadow_color = imagecolorallocatealpha( $canvas, 0, 0, 0, $shadow_alpha );
					if ( $use_ttf && $font_path ) {
						imagettftext( $canvas, $font_size, 0, $text_x, $text_y + $shadow_offset, $shadow_color, $font_path, $display_text );
					} else {
						imagestring( $canvas, 5, $text_x, $text_y - $text_height + $shadow_offset, $display_text, $shadow_color );
					}
				}
				
				// Dessiner le texte principal
				if ( $use_ttf && $font_path ) {
					imagettftext( $canvas, $font_size, 0, $text_x, $text_y, $number_color_gd, $font_path, $display_text );
				} else {
					imagestring( $canvas, 5, $text_x, $text_y - $text_height, $display_text, $number_color_gd );
				}
			}
		}
		
		// Dessiner les aiguilles de l'horloge (seulement si demandé)
		if ( $draw_hands ) {
			$hands_color_hex = isset( $config['color'] ) ? $config['color'] : '#111111';
			$hands_rgb = $this->hex_to_rgb( $hands_color_hex );
			$hands_color = imagecolorallocate( $canvas, $hands_rgb['r'], $hands_rgb['g'], $hands_rgb['b'] );
			
			// Aiguille des heures (position 3h pour l'exemple)
			$hour_length = $output_size * 0.208; // ~150px pour 720px de base
			$hour_width = max( 2, $output_size * 0.011 ); // ~8px pour 720px
			$hour_angle = 90; // 3h = 90 degrés
			$this->draw_hand( $canvas, $center_x, $center_y, $hour_length, $hour_width, $hour_angle, $hands_color, $scale_factor );
			
			// Aiguille des minutes (position 12h pour l'exemple)
			$minute_length = $output_size * 0.306; // ~220px pour 720px
			$minute_width = max( 1, $output_size * 0.008 ); // ~6px pour 720px
			$minute_angle = 0; // 12h = 0 degrés
			$this->draw_hand( $canvas, $center_x, $center_y, $minute_length, $minute_width, $minute_angle, $hands_color, $scale_factor );
			
			// Aiguille des secondes (trotteuse) si activée
			$second_hand = isset( $config['second_hand'] ) ? $config['second_hand'] : 'black';
			if ( $second_hand !== 'none' ) {
				$second_color_hex = ( $second_hand === 'red' ) ? '#cc1f1a' : '#111111';
				$second_rgb = $this->hex_to_rgb( $second_color_hex );
				$second_color = imagecolorallocate( $canvas, $second_rgb['r'], $second_rgb['g'], $second_rgb['b'] );
				$second_length = $output_size * 0.306; // ~220px
				$second_width = max( 1, $output_size * 0.003 ); // ~2px
				$second_angle = 270; // 9h = 270 degrés pour l'exemple
				$this->draw_hand( $canvas, $center_x, $center_y, $second_length, $second_width, $second_angle, $second_color, $scale_factor );
			}
			
			// Centre des aiguilles
			$center_size_hands = max( 8, $output_size * 0.044 ); // ~32px pour 720px
			$center_color = imagecolorallocate( $canvas, 17, 17, 17 ); // #111111
			imagefilledellipse( $canvas, $center_x, $center_y, $center_size_hands, $center_size_hands, $center_color );
		}
		
		// Pas de bordure pour le PDF HD
		
		// Dessiner les aiguilles si demandé...
		
		// DEBUG: Afficher la config debug en bas du canvas (temporaire)
		$debug_text = "Debug: Slots=" . count($slots) . ", ShowSlots=" . ($show_slots ? 'Yes' : 'No') . ", BaseSize=" . $base_size . ", Scale=" . $scale_factor;
		$black = imagecolorallocate( $canvas, 0, 0, 0 );
		imagestring( $canvas, 5, 50, $output_size - 100, $debug_text, $black );
		
		return $canvas;
	}
	
	/**
	 * Convertit une couleur hexadécimale en RGB.
	 *
	 * @param string $hex Code couleur hexadécimal.
	 * @return array Tableau avec r, g, b.
	 */
	private function hex_to_rgb( $hex ) {
		$hex = str_replace( '#', '', $hex );
		if ( strlen( $hex ) == 3 ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}
		return array(
			'r' => hexdec( substr( $hex, 0, 2 ) ),
			'g' => hexdec( substr( $hex, 2, 2 ) ),
			'b' => hexdec( substr( $hex, 4, 2 ) ),
		);
	}
	
	/**
	 * Log debug messages to a file.
	 * 
	 * @param string $message Message to log.
	 */
	private function log( $message ) {
		$log_file = dirname( __FILE__ ) . '/wc-pc13-debug.log';
		$entry = date( 'Y-m-d H:i:s' ) . ' - ' . $message . PHP_EOL;
		// Debug echo for CLI
		if ( defined( 'WP_CLI' ) || php_sapi_name() === 'cli' ) {
			echo "[LOG] " . $message . "\n";
		}
		file_put_contents( $log_file, $entry, FILE_APPEND );
	}



	private function load_image_resource( $url, $attachment_id = 0 ) {
		// Ignore blob/data URLs
		if ( strpos( $url, 'blob:' ) === 0 || strpos( $url, 'data:' ) === 0 ) {
			$this->log( "Skipping blob/data URL: $url" );
			return false;
		}

		$this->log( "Loading image: URL=$url, ID=$attachment_id" );
		
		$local_path = '';

		// 1. Essayer avec l'attachment ID si fourni (plus fiable)
		if ( $attachment_id ) {
			$path = get_attached_file( $attachment_id );
			if ( $path && file_exists( $path ) ) {
				$local_path = $path;
				$this->log( "Found via attachment ID: $local_path" );
			} else {
				$this->log( "Attachment ID $attachment_id found but file missing: " . ( $path ? $path : 'no path' ) );
			}
		}

		// 2. Si pas trouvé, essayer de convertir l'URL en chemin local
		if ( empty( $local_path ) && ! empty( $url ) ) {
			// Normaliser l'URL (protocole, etc)
			$url_no_scheme = preg_replace( '#^https?://#', '', $url );
			$upload_dir = wp_upload_dir();
			$baseurl_no_scheme = preg_replace( '#^https?://#', '', $upload_dir['baseurl'] );
			
			$this->log( "Path resolution debug: URL_NO_SCHEME='$url_no_scheme', BASEURL_NO_SCHEME='$baseurl_no_scheme'" );

			// Essayer de remplacer baseurl par basedir
			if ( strpos( $url_no_scheme, $baseurl_no_scheme ) !== false ) {
				$rel_path = str_replace( $baseurl_no_scheme, '', $url_no_scheme );
				$test_path = $upload_dir['basedir'] . $rel_path;
				if ( file_exists( $test_path ) ) {
					$local_path = $test_path;
					$this->log( "Found local path from URL match: $local_path" );
				} else {
					$this->log( "URL matched baseurl but file not found at: $test_path" );
				}
			} else {
				$this->log( "URL did not match baseurl." );
			}

			// 2.5. Generic local path resolution (site_url -> ABSPATH)
			if ( empty( $local_path ) ) {
				$site_url_no_scheme = preg_replace( '#^https?://#', '', site_url() );
				// Ensure simple matching at start of string
				if ( strpos( $url_no_scheme, $site_url_no_scheme ) === 0 ) {
					$rel_path = substr( $url_no_scheme, strlen( $site_url_no_scheme ) );
					$test_path = wp_normalize_path( ABSPATH . '/' . ltrim( $rel_path, '/' ) );
					$this->log( "Testing generic local path: $test_path" );
					if ( file_exists( $test_path ) ) {
						$local_path = $test_path;
						$this->log( "Found local path via ABSPATH match: $local_path" );
					}
				}
			}
			
			// Si toujours pas trouvé, chercher wp-content/uploads
			if ( empty( $local_path ) && strpos( $url, 'wp-content/uploads' ) !== false ) {
				$parts = explode( 'wp-content/uploads', $url );
				if ( count( $parts ) > 1 ) {
					$rel_path = $parts[1];
					$test_path = $upload_dir['basedir'] . $rel_path;
					if ( file_exists( $test_path ) ) {
						$local_path = $test_path;
						$this->log( "Found local path via 'wp-content/uploads': $local_path" );
					} else {
						$this->log( "URL contains wp-content/uploads but file not found at: $test_path" );
					}
				}
			}
		}

		// 3. Charger l'image depuis le chemin local
		if ( ! empty( $local_path ) ) {
			$image_info = @getimagesize( $local_path );
			if ( ! $image_info ) {
				$this->log( "getimagesize failed on $local_path" );
				return false;
			}
			
			$image = false;
			switch ( $image_info[2] ) {
				case IMAGETYPE_JPEG:
					$image = imagecreatefromjpeg( $local_path );
					break;
				case IMAGETYPE_PNG:
					$image = imagecreatefrompng( $local_path );
					if ( $image ) {
						imagealphablending( $image, false );
						imagesavealpha( $image, true );
					}
					break;
				case IMAGETYPE_GIF:
					$image = imagecreatefromgif( $local_path );
					break;
				case IMAGETYPE_WEBP:
					$image = imagecreatefromwebp( $local_path );
					if ( $image ) {
						imagealphablending( $image, false );
						imagesavealpha( $image, true );
					}
					break;
				default:
					$this->log( "Unsupported image type: " . $image_info[2] );
					return false;
			}
			
			if ( $image ) {
				return $image;
			}
			$this->log( "imagecreatefrom... failed for $local_path" );
		}
		
		// 4. Fallback: télécharger l'image depuis l'URL (plus lent et risqué)
		if ( ! empty( $url ) ) {
			$this->log( "Attempting remote download: $url" );
			$response = wp_remote_get( $url, array( 'timeout' => 10, 'sslverify' => false ) );
			if ( is_wp_error( $response ) ) {
				$this->log( "wp_remote_get error: " . $response->get_error_message() );
				return false;
			}
			
			$response_code = wp_remote_retrieve_response_code( $response );
			if ( $response_code != 200 ) {
				$this->log( "wp_remote_get failed with status: $response_code" );
				return false;
			}
			
			$image_data = wp_remote_retrieve_body( $response );
			if ( empty( $image_data ) ) {
				$this->log( "Empty body from remote" );
				return false;
			}
			
			try {
				$image = imagecreatefromstring( $image_data );
				if ( $image ) {
					// Gérer la transparence pour PNG/WebP qui passeraient par ici
					imagesavealpha( $image, true );
					return $image;
				}
			} catch ( Exception $e ) {
				$this->log( "imagecreatefromstring exception: " . $e->getMessage() );
			}
			$this->log( "imagecreatefromstring failed" );
		}
		
		return false;
	}
	

	
	/**
	 * Dessine une image circulaire sur le canvas GD avec transformations.
	 *
	 * @param resource $canvas Canvas GD.
	 * @param float    $center_x Centre X.
	 * @param float    $center_y Centre Y.
	 * @param float    $diameter Diamètre.
	 * @param resource $image Ressource image GD.
	 * @param array    $transform État de transformation (scale, x, y).
	 * @param float    $scale_factor Facteur d'échelle.
	 */
	private function draw_circular_image_gd( $canvas, $center_x, $center_y, $diameter, $image, $transform, $scale_factor = 1.0 ) {
		if ( ! $image || ! $canvas ) {
			return;
		}
		
		$radius = $diameter / 2;
		$image_width = imagesx( $image );
		$image_height = imagesy( $image );
		
		// Créer une image temporaire avec transparence
		$temp = imagecreatetruecolor( $diameter, $diameter );
		imagealphablending( $temp, false );
		imagesavealpha( $temp, true );
		$transparent = imagecolorallocatealpha( $temp, 0, 0, 0, 127 );
		imagefill( $temp, 0, 0, $transparent );
		imagealphablending( $temp, true );
		
		// Calculer les dimensions de dessin avec le zoom
		$scale = isset( $transform['scale'] ) ? floatval( $transform['scale'] ) : 1.0;
		$base_scale = max( $diameter / $image_width, $diameter / $image_height );
		$final_scale = $base_scale * $scale;
		$draw_width = $image_width * $final_scale;
		$draw_height = $image_height * $final_scale;
		
		// Calculer les offsets
		$x_offset_pct = isset( $transform['x'] ) ? floatval( $transform['x'] ) : 0.0;
		$y_offset_pct = isset( $transform['y'] ) ? floatval( $transform['y'] ) : 0.0;
		$translate_x = ( $x_offset_pct / 100 ) * $diameter;
		$translate_y = ( $y_offset_pct / 100 ) * $diameter;
		$offset_x = ( $diameter - $draw_width ) / 2 + $translate_x;
		$offset_y = ( $diameter - $draw_height ) / 2 + $translate_y;
		
		// Redimensionner et positionner l'image avec préservation de la transparence
		imagealphablending( $image, true );
		imagecopyresampled(
			$temp,
			$image,
			$offset_x,
			$offset_y,
			0,
			0,
			$draw_width,
			$draw_height,
			$image_width,
			$image_height
		);
		
		// Appliquer le masque circulaire de manière optimisée
		imagealphablending( $temp, false );
		imagesavealpha( $temp, true );
		
		// Appliquer le masque circulaire en parcourant les pixels
		$radius_sq = $radius * $radius;
		$transparent_color = imagecolorallocatealpha( $temp, 0, 0, 0, 127 );
		
		// Parcourir les pixels pour appliquer le masque circulaire
		for ( $x = 0; $x < $diameter; $x++ ) {
			for ( $y = 0; $y < $diameter; $y++ ) {
				$dx = $x - $radius;
				$dy = $y - $radius;
				$distance_sq = $dx * $dx + $dy * $dy;
				
				if ( $distance_sq > $radius_sq ) {
					// Pixel en dehors du cercle : rendre transparent
					imagesetpixel( $temp, $x, $y, $transparent_color );
				}
			}
		}
		
		imagealphablending( $temp, true );
		
		// Copier sur le canvas principal avec préservation de la transparence
		imagealphablending( $canvas, true );
		// Utiliser imagecopymerge pour préserver la transparence
		imagecopymerge(
			$canvas,
			$temp,
			(int) ( $center_x - $radius ),
			(int) ( $center_y - $radius ),
			0,
			0,
			(int) $diameter,
			(int) $diameter,
			100
		);
		
		imagedestroy( $temp );
	}
	
	/**
	 * Dessine une aiguille d'horloge sur le canvas.
	 *
	 * @param resource $canvas Canvas GD.
	 * @param float    $center_x Centre X.
	 * @param float    $center_y Centre Y.
	 * @param float    $length Longueur de l'aiguille.
	 * @param float    $width Largeur de l'aiguille.
	 * @param float    $angle Angle en degrés (0 = haut, 90 = droite).
	 * @param int      $color Couleur GD.
	 * @param float    $scale_factor Facteur d'échelle.
	 */
	private function draw_hand( $canvas, $center_x, $center_y, $length, $width, $angle, $color, $scale_factor = 1.0 ) {
		$angle_rad = deg2rad( $angle );
		
		// Calculer les points de l'aiguille (rectangle arrondi)
		$end_x = $center_x + sin( $angle_rad ) * $length;
		$end_y = $center_y - cos( $angle_rad ) * $length;
		
		// Angle perpendiculaire pour la largeur
		$perp_angle = $angle_rad + ( M_PI / 2 );
		$half_width = $width / 2;
		
		// Points du rectangle
		$p1_x = $center_x + cos( $perp_angle ) * $half_width;
		$p1_y = $center_y + sin( $perp_angle ) * $half_width;
		$p2_x = $end_x + cos( $perp_angle ) * $half_width;
		$p2_y = $end_y + sin( $perp_angle ) * $half_width;
		$p3_x = $end_x - cos( $perp_angle ) * $half_width;
		$p3_y = $end_y - sin( $perp_angle ) * $half_width;
		$p4_x = $center_x - cos( $perp_angle ) * $half_width;
		$p4_y = $center_y - sin( $perp_angle ) * $half_width;
		
		// Dessiner le rectangle arrondi
		$points = array(
			(int) $p1_x, (int) $p1_y,
			(int) $p2_x, (int) $p2_y,
			(int) $p3_x, (int) $p3_y,
			(int) $p4_x, (int) $p4_y,
		);
		
		imagefilledpolygon( $canvas, $points, 4, $color );
		
		// Dessiner une ombre portée légère
		$shadow_offset = 2 * $scale_factor;
		$shadow_color = imagecolorallocatealpha( $canvas, 0, 0, 0, 77 ); // rgba(0,0,0,0.3)
		$shadow_points = array(
			(int) ( $p1_x + $shadow_offset ), (int) ( $p1_y + $shadow_offset ),
			(int) ( $p2_x + $shadow_offset ), (int) ( $p2_y + $shadow_offset ),
			(int) ( $p3_x + $shadow_offset ), (int) ( $p3_y + $shadow_offset ),
			(int) ( $p4_x + $shadow_offset ), (int) ( $p4_y + $shadow_offset ),
		);
		imagefilledpolygon( $canvas, $shadow_points, 4, $shadow_color );
		
		// Redessiner l'aiguille par-dessus l'ombre
		imagefilledpolygon( $canvas, $points, 4, $color );
	}

	/**
	 * Retourne le texte à afficher pour un chiffre d'horloge.
	 *
	 * @param int    $number Numéro (1-12).
	 * @param string $type Type (arabic ou roman).
	 * @param string $intermediate Points intermédiaires (with ou without).
	 * @return string Texte à afficher.
	 */
	private function get_dial_display_text( $number, $type = 'arabic', $intermediate = 'without' ) {
		if ( 'roman' === $type ) {
			$romans = array( 1 => 'I', 2 => 'II', 3 => 'III', 4 => 'IV', 5 => 'V', 6 => 'VI', 7 => 'VII', 8 => 'VIII', 9 => 'IX', 10 => 'X', 11 => 'XI', 12 => 'XII' );
			return isset( $romans[ $number ] ) ? $romans[ $number ] : (string) $number;
		}
		
		if ( 'with' === $intermediate ) {
			// Afficher avec points intermédiaires (ex: 1• pour 1)
			return $number . '•';
		}
		
		return (string) $number;
	}

	/**
	 * Génère un PDF HD à partir de la configuration et des images sources d'un item de commande.
	 */
	public function generate_order_pdf() {
		// Enregistrer une fonction d'arrêt pour capturer les erreurs fatales
		register_shutdown_function( function() {
			$error = error_get_last();
			if ( $error && ( $error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_COMPILE_ERROR || $error['type'] === E_CORE_ERROR ) ) {
				$log_file = dirname( __FILE__ ) . '/wc-pc13-debug.log';
				$entry = date( 'Y-m-d H:i:s' ) . ' - FATAL ERROR: ' . print_r( $error, true ) . PHP_EOL;
				file_put_contents( $log_file, $entry, FILE_APPEND );
			}
		});

		// Augmenter la mémoire et le temps d'exécution pour la génération HD
		@ini_set( 'memory_limit', '-1' );
		@set_time_limit( 600 );
		
		$this->log( "Starting PDF generation..." );

		try {
			$item_id = isset( $_GET['item_id'] ) ? absint( $_GET['item_id'] ) : 0;
			$nonce = isset( $_GET['nonce'] ) ? sanitize_text_field( wp_unslash( $_GET['nonce'] ) ) : '';

			if ( ! $item_id || ! wp_verify_nonce( $nonce, 'wc_pc13_generate_pdf_' . $item_id ) ) {
				throw new Exception( __( 'Erreur de sécurité.', 'wc-photo-clock-13' ) );
			}

			// Récupérer l'item de commande
			$order_item = new WC_Order_Item_Product( $item_id );
			if ( ! $order_item->get_id() ) {
				throw new Exception( __( 'Item de commande introuvable.', 'wc-photo-clock-13' ) );
			}

		// Récupérer la configuration complète
		$config_meta = $order_item->get_meta( 'wc_pc13_config', true );
		if ( ! $config_meta ) {
			throw new Exception( __( 'Configuration introuvable.', 'wc-photo-clock-13' ) );
		}

		$config = json_decode( $config_meta, true );
		if ( empty( $config ) || ! is_array( $config ) ) {
			throw new Exception( __( 'Configuration invalide.', 'wc-photo-clock-13' ) );
		}

		$diameter = isset( $config['diameter'] ) ? absint( $config['diameter'] ) : 40;
		$pdf_size_mm = $diameter * 10; // Convertir cm en mm
		$pdf_width_points  = $pdf_size_mm * 2.83465; // 1 mm = 2.83465 points
		$pdf_height_points = $pdf_size_mm * 2.83465;

		// Vérifier que GD est disponible
		if ( ! function_exists( 'imagecreatetruecolor' ) ) {
			throw new Exception( __( 'GD n\'est pas disponible sur ce serveur.', 'wc-photo-clock-13' ) );
		}

		// Construire le canvas HD à partir des images sources
		$base_size = 360; // Taille de base comme côté frontend
		$canvas = $this->build_high_res_canvas( $config, $base_size, false );
		
		if ( ! $canvas ) {
			throw new Exception( __( 'Erreur lors de la création du canvas HD.', 'wc-photo-clock-13' ) );
		}

		// Calculer la taille cible pour le PDF en haute résolution (300 DPI)
		$dpi = 300;
		$pdf_size_inches = $pdf_size_mm / 25.4; // Convertir mm en pouces
		$target_pixels = (int) ( $pdf_size_inches * $dpi ); // Taille en pixels à 300 DPI
		
		// Redimensionner le canvas pour correspondre à la taille du PDF en haute résolution
		$canvas_width = imagesx( $canvas );
		$canvas_height = imagesy( $canvas );
		
		if ( $canvas_width !== $target_pixels || $canvas_height !== $target_pixels ) {
			// Créer un nouveau canvas à la taille cible
			$resized_canvas = imagecreatetruecolor( $target_pixels, $target_pixels );
			if ( $resized_canvas ) {
				imagealphablending( $resized_canvas, false );
				imagesavealpha( $resized_canvas, true );
				// Redimensionner avec un filtre de haute qualité
				imagecopyresampled(
					$resized_canvas,
					$canvas,
					0, 0, 0, 0,
					$target_pixels,
					$target_pixels,
					$canvas_width,
					$canvas_height
				);
				imagedestroy( $canvas );
				$canvas = $resized_canvas;
			}
		}

		// Générer le PDF directement depuis le canvas GD
		$upload_dir = wp_upload_dir();
		$pdf_filename = 'wc-pc13-order-' . $item_id . '-' . time() . '.pdf';
		$pdf_path = $upload_dir['path'] . '/' . $pdf_filename;

		// Générer le PDF directement depuis le canvas GD (sans JPEG intermédiaire)
		if ( ! $this->generate_pdf_from_canvas( $canvas, $pdf_path, (int) $pdf_width_points, (int) $pdf_height_points ) ) {
			imagedestroy( $canvas );
			throw new Exception( __( 'Erreur lors de la génération du PDF.', 'wc-photo-clock-13' ) );
		}

		imagedestroy( $canvas );

		// Créer l'attachment
		$attachment = array(
			'post_mime_type' => 'application/pdf',
			'post_title'     => sanitize_text_field( 'Horloge PDF HD - Commande ' . $order_item->get_order_id() ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attachment_id = wp_insert_attachment( $attachment, $pdf_path );
		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $pdf_path );
			throw new Exception( __( 'Erreur lors de l\'enregistrement du PDF.', 'wc-photo-clock-13' ) );
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $pdf_path ) );

		// Sauvegarder les métadonnées PDF dans l'item
		$pdf_meta_data = array(
			'id'  => $attachment_id,
			'url' => wp_get_attachment_url( $attachment_id ),
		);
		$order_item->update_meta_data( 'wc_pc13_pdf', wp_json_encode( $pdf_meta_data ) );
		$order_item->save();

		// Rediriger vers le PDF
		wp_redirect( wp_get_attachment_url( $attachment_id ) );
		exit;

		} catch ( Exception $e ) {
			wp_die( esc_html( $e->getMessage() ) );
		} catch ( Error $e ) {
			wp_die( esc_html( 'Erreur fatale : ' . $e->getMessage() . ' à la ligne ' . $e->getLine() ) );
		}
	}

	/**
	 * Masque les métadonnées de configuration dans l'affichage standard.
	 *
	 * @param array $hidden Liste des métadonnées cachées.
	 * @return array
	 */
	public function hide_config_meta( $hidden ) {
		$hidden[] = 'wc_pc13_config';
		$hidden[] = 'wc_pc13_preview';
		$hidden[] = 'wc_pc13_pdf';
		return $hidden;
	}

	/**
	 * Masque la clé de métadonnée si elle est déjà affichée.
	 *
	 * @param string $display_key Clé d'affichage.
	 * @return string|false
	 */
	public function hide_config_meta_key( $display_key ) {
		if ( 'wc_pc13_config' === $display_key || 'wc_pc13_preview' === $display_key || 'wc_pc13_pdf' === $display_key ) {
			return false; // Masquer complètement
		}
		return $display_key;
	}

	/**
	 * Ajoute un rappel dans les emails.
	 *
	 * @param WC_Order $order Commande.
	 * @param bool     $sent_to_admin Pour admin.
	 * @param bool     $plain_text Texte brut.
	 * @param string   $email Email actuel.
	 */
	public function render_email_summary( $order, $sent_to_admin, $plain_text, $email ) {
		unset( $email );

		// Ne pas afficher pour les emails en texte brut
		if ( $plain_text ) {
			return;
		}

		foreach ( $order->get_items() as $item ) {
			$config = $item->get_meta( 'wc_pc13_config', true );
			if ( ! $config ) {
				continue;
			}

			$data = json_decode( $config, true );
			if ( empty( $data ) ) {
				continue;
			}

			// Récupérer l'aperçu
			$preview_meta = $item->get_meta( 'wc_pc13_preview', true );
			$preview_url = '';
			$preview_id = 0;
			if ( $preview_meta ) {
				$preview_data = json_decode( $preview_meta, true );
				if ( ! empty( $preview_data['url'] ) ) {
					$preview_url = esc_url( $preview_data['url'] );
				} elseif ( ! empty( $preview_data['id'] ) ) {
					$preview_id = absint( $preview_data['id'] );
					$preview_url = esc_url( wp_get_attachment_url( $preview_id ) );
				}
			}

			echo '<div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px;">';
			echo '<h3 style="margin-top: 0;">' . esc_html__( 'Horloge Photo personnalisée', 'wc-photo-clock-13' ) . '</h3>';
			
			// Afficher l'aperçu si disponible
			if ( $preview_url ) {
				$preview_image_url = $preview_url;
				if ( $preview_id ) {
					$preview_image_url = wp_get_attachment_image_url( $preview_id, 'medium' );
					if ( ! $preview_image_url ) {
						$preview_image_url = $preview_url;
					}
				}
				echo '<div style="margin-bottom: 15px; text-align: center;">';
				echo '<a href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer" style="display: inline-block;">';
				echo '<img src="' . esc_url( $preview_image_url ) . '" alt="' . esc_attr__( 'Aperçu de l\'horloge', 'wc-photo-clock-13' ) . '" style="max-width: 100%; max-width: 500px; height: auto; border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />';
				echo '</a>';
				echo '<p style="margin-top: 10px; font-size: 12px; color: #666;">';
				echo '<a href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer" style="color: #2271b1; text-decoration: none;">' . esc_html__( 'Télécharger l\'aperçu en haute résolution', 'wc-photo-clock-13' ) . '</a>';
				echo '</p>';
				echo '</div>';
			}

			echo '<ul style="list-style: none; padding: 0;">';
			echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Produit :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( $item->get_name() ) . '</li>';
			if ( ! empty( $data['hands'] ) ) {
				echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Style d\'aiguilles :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( $data['hands'] ) . '</li>';
			}
			if ( ! empty( $data['color'] ) ) {
				echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Couleur :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( $data['color'] ) . '</li>';
			}
			if ( array_key_exists( 'show_numbers', $data ) ) {
				$has_numbers = wc_string_to_bool( $data['show_numbers'] );
				echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Chiffres des heures :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( $has_numbers ? __( 'Oui', 'wc-photo-clock-13' ) : __( 'Non', 'wc-photo-clock-13' ) ) . '</li>';
				if ( $has_numbers && ! empty( $data['numbers'] ) && is_array( $data['numbers'] ) ) {
					if ( ! empty( $data['numbers']['color'] ) ) {
						echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Couleur des chiffres :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( sanitize_hex_color( $data['numbers']['color'] ) ) . '</li>';
					}
					if ( isset( $data['numbers']['size'] ) ) {
						echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Taille des chiffres :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( absint( $data['numbers']['size'] ) ) . ' px</li>';
					}
					$distance_value = null;
					if ( isset( $data['numbers']['distance'] ) ) {
						$distance_value = absint( $data['numbers']['distance'] );
					} elseif ( isset( $data['numbers']['offset'] ) ) {
						$distance_value = absint( $data['numbers']['offset'] );
					}

					if ( null !== $distance_value ) {
						echo '<li style="margin-bottom: 8px;"><strong>' . esc_html__( 'Distance depuis le centre :', 'wc-photo-clock-13' ) . '</strong> ' . esc_html( $distance_value ) . ' px</li>';
					}
				}
			}
			echo '</ul>';
			echo '</div>';
			break;
		}
	}
}


