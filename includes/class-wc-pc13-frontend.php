<?php
/**
 * Interface frontale du configurateur.
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_PC13_Frontend {

	/**
	 * Instance.
	 *
	 * @var WC_PC13_Frontend|null
	 */
	protected static $instance = null;

	/**
	 * Singleton.
	 *
	 * @return WC_PC13_Frontend
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
		add_action( 'woocommerce_before_add_to_cart_button', array( $this, 'render_configurator' ), 5 );
		add_filter( 'woocommerce_add_cart_item_data', array( $this, 'add_cart_item_data' ), 10, 3 );
		add_filter( 'woocommerce_get_item_data', array( $this, 'display_cart_item_data' ), 10, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'add_order_item_meta' ), 10, 4 );
		add_action( 'wp_ajax_wc_pc13_upload_preview', array( $this, 'handle_preview_upload' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_upload_preview', array( $this, 'handle_preview_upload' ) );
		add_action( 'wp_ajax_wc_pc13_upload_pdf', array( $this, 'handle_pdf_upload' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_upload_pdf', array( $this, 'handle_pdf_upload' ) );
		add_filter( 'woocommerce_cart_item_thumbnail', array( $this, 'filter_cart_item_thumbnail' ), 10, 3 );
		add_filter( 'woocommerce_checkout_cart_item_thumbnail', array( $this, 'filter_cart_item_thumbnail' ), 10, 3 );
		add_filter( 'woocommerce_order_item_thumbnail', array( $this, 'filter_order_item_thumbnail' ), 10, 3 );
		add_action( 'woocommerce_before_add_to_cart_quantity', array( $this, 'hide_quantity_selector' ), 5 );
		add_action( 'woocommerce_after_add_to_cart_quantity', array( $this, 'hide_quantity_selector_end' ), 5 );
	}

	/**
	 * Affiche le configurateur si activé.
	 */
	public function render_configurator() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' !== $enabled ) {
			return;
		}

		$default_color    = $product->get_meta( '_wc_pc13_default_color' );

		$settings = class_exists( 'WC_PC13_Admin' ) ? WC_PC13_Admin::instance()->get_settings() : array(
			'default_color'    => '#111111',
		);

		$args = array(
			'product_id'       => $product->get_id(),
			'default_color'    => $default_color ? $default_color : $settings['default_color'],
			'button_text'      => $product->single_add_to_cart_text(),
		);

		wc_get_template(
			'configurator.php',
			$args,
			'wc-photo-clock-13',
			WC_PC13_PLUGIN_DIR . 'templates/'
		);
	}

	/**
	 * Enregistre les données du configurateur dans l’item.
	 *
	 * @param array     $cart_item_data Données actuelles.
	 * @param int       $product_id ID produit.
	 * @param int       $variation_id ID variation.
	 *
	 * @return array
	 */
	public function add_cart_item_data( $cart_item_data, $product_id, $variation_id ) {
		if ( empty( $_POST['wc_pc13_payload'] ) ) {
			return $cart_item_data;
		}

		$payload = json_decode( wp_unslash( $_POST['wc_pc13_payload'] ), true );

		if ( empty( $payload ) || ! is_array( $payload ) ) {
			return $cart_item_data;
		}

		$cart_item_data['wc_pc13'] = self::sanitize_payload( $payload );

		$preview_id  = isset( $_POST['wc_pc13_preview_id'] ) ? absint( wp_unslash( $_POST['wc_pc13_preview_id'] ) ) : 0;
		$preview_url = isset( $_POST['wc_pc13_preview_url'] ) ? esc_url_raw( wp_unslash( $_POST['wc_pc13_preview_url'] ) ) : '';

		if ( $preview_id || $preview_url ) {
			$cart_item_data['wc_pc13_preview'] = array(
				'id'  => $preview_id,
				'url' => $preview_url,
			);
		}

		$pdf_id  = isset( $_POST['wc_pc13_pdf_id'] ) ? absint( wp_unslash( $_POST['wc_pc13_pdf_id'] ) ) : 0;
		$pdf_url = isset( $_POST['wc_pc13_pdf_url'] ) ? esc_url_raw( wp_unslash( $_POST['wc_pc13_pdf_url'] ) ) : '';

		if ( $pdf_id || $pdf_url ) {
			$cart_item_data['wc_pc13_pdf'] = array(
				'id'  => $pdf_id,
				'url' => $pdf_url,
			);
		}

		$cart_item_data['unique_key'] = md5( microtime() . rand() ); // Force item unique.

		return $cart_item_data;
	}

	/**
	 * Affiche les données dans le panier.
	 *
	 * @param array $item_data Données d’affichage.
	 * @param array $cart_item Données item.
	 *
	 * @return array
	 */
	public function display_cart_item_data( $item_data, $cart_item ) {
		if ( empty( $cart_item['wc_pc13'] ) ) {
			return $item_data;
		}

		$config = $cart_item['wc_pc13'];

		// Compter les photos
		$center_has_photo = ! empty( $config['center']['image_url'] ) || ! empty( $config['center']['attachment_id'] );
		$slots_with_photo = 0;
		if ( ! empty( $config['slots'] ) && is_array( $config['slots'] ) ) {
			foreach ( $config['slots'] as $slot ) {
				if ( ! empty( $slot['image_url'] ) || ! empty( $slot['attachment_id'] ) ) {
					$slots_with_photo++;
				}
			}
		}

		// Construire les badges de réglages
		$badges = array();
		
		// Badge diamètre avec prix
		if ( ! empty( $config['diameter'] ) ) {
			$diameter = absint( $config['diameter'] );
			$price = isset( $config['diameter_price'] ) ? floatval( $config['diameter_price'] ) : 59;
			$badges[] = '<span class="wc-pc13-cart-badge wc-pc13-cart-badge-diameter">' . 
				sprintf( esc_html__( '%d cm - %s€', 'wc-photo-clock-13' ), $diameter, number_format_i18n( $price, 0 ) ) . 
				'</span>';
		}
		
		if ( ! empty( $config['hands'] ) && ! empty( $config['color'] ) ) {
			$color_display = sanitize_hex_color( $config['color'] );
			$hands_label = ucfirst( sanitize_text_field( $config['hands'] ) );
			$badges[] = '<span class="wc-pc13-cart-badge wc-pc13-cart-badge-hands">' . 
				'<span class="wc-pc13-cart-color-indicator" style="background-color: ' . esc_attr( $color_display ) . ';"></span>' .
				esc_html__( 'Aiguilles', 'wc-photo-clock-13' ) . ': ' . esc_html( $hands_label ) . ' ' . esc_html( $color_display ) . 
				'</span>';
		} elseif ( ! empty( $config['hands'] ) ) {
			$badges[] = '<span class="wc-pc13-cart-badge">' . esc_html__( 'Aiguilles', 'wc-photo-clock-13' ) . ': ' . esc_html( ucfirst( $config['hands'] ) ) . '</span>';
		} elseif ( ! empty( $config['color'] ) ) {
			$color_display = sanitize_hex_color( $config['color'] );
			$badges[] = '<span class="wc-pc13-cart-badge wc-pc13-cart-badge-hands">' . 
				'<span class="wc-pc13-cart-color-indicator" style="background-color: ' . esc_attr( $color_display ) . ';"></span>' .
				esc_html__( 'Aiguilles', 'wc-photo-clock-13' ) . ': ' . esc_html( $color_display ) . 
				'</span>';
		}
		if ( array_key_exists( 'show_numbers', $config ) && wc_string_to_bool( $config['show_numbers'] ) ) {
			$badges[] = '<span class="wc-pc13-cart-badge wc-pc13-cart-badge-numbers">' . esc_html__( 'Chiffres', 'wc-photo-clock-13' ) . '</span>';
		}

		// Construire le HTML compact
		$summary_parts = array();
		$summary_parts[] = sprintf( __( '%d photo(s) centrale(s)', 'wc-photo-clock-13' ), $center_has_photo ? 1 : 0 );
		$summary_parts[] = sprintf( __( '%d photo(s) périphérique(s)', 'wc-photo-clock-13' ), $slots_with_photo );

		$preview_url = '';
		$pdf_url = '';
		if ( ! empty( $cart_item['wc_pc13_preview'] ) && is_array( $cart_item['wc_pc13_preview'] ) ) {
			$preview_data = $cart_item['wc_pc13_preview'];
			if ( ! empty( $preview_data['url'] ) ) {
				$preview_url = esc_url( $preview_data['url'] );
			} elseif ( ! empty( $preview_data['id'] ) ) {
				$preview_url = esc_url( wp_get_attachment_url( absint( $preview_data['id'] ) ) );
			}
		}
		if ( ! empty( $cart_item['wc_pc13_pdf'] ) && is_array( $cart_item['wc_pc13_pdf'] ) ) {
			$pdf_data = $cart_item['wc_pc13_pdf'];
			if ( ! empty( $pdf_data['url'] ) ) {
				$pdf_url = esc_url( $pdf_data['url'] );
			} elseif ( ! empty( $pdf_data['id'] ) ) {
				$pdf_url = esc_url( wp_get_attachment_url( absint( $pdf_data['id'] ) ) );
			}
		}

		$download_buttons = '';
		if ( $preview_url || $pdf_url ) {
			$download_buttons = '<div class="wc-pc13-cart-download-buttons">';
			if ( $preview_url ) {
				$download_buttons .= '<a href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer" class="wc-pc13-cart-download-btn">' . esc_html__( 'JPEG', 'wc-photo-clock-13' ) . '</a>';
			}
			if ( $pdf_url ) {
				$download_buttons .= '<a href="' . esc_url( $pdf_url ) . '" target="_blank" rel="noopener noreferrer" class="wc-pc13-cart-download-btn">' . esc_html__( 'PDF HD', 'wc-photo-clock-13' ) . '</a>';
			}
			$download_buttons .= '</div>';
		}

		$value_html = '<div class="wc-pc13-cart-summary">';
		if ( ! empty( $badges ) ) {
			$value_html .= '<div class="wc-pc13-cart-badges">' . implode( ' ', $badges ) . '</div>';
		}
		$value_html .= '<div class="wc-pc13-cart-info">';
		$value_html .= '<div class="wc-pc13-cart-photos">';
		if ( $center_has_photo ) {
			$value_html .= '<span class="wc-pc13-cart-photo-item"><span class="wc-pc13-cart-icon">🖼️</span> ' . esc_html__( '1 photo centrale', 'wc-photo-clock-13' ) . '</span>';
		}
		if ( $slots_with_photo > 0 ) {
			$value_html .= '<span class="wc-pc13-cart-photo-item"><span class="wc-pc13-cart-icon">📸</span> ' . sprintf( esc_html__( '%d photos périphériques', 'wc-photo-clock-13' ), $slots_with_photo ) . '</span>';
		}
		$value_html .= '</div>';
		$value_html .= '</div>';
		if ( $download_buttons ) {
			$value_html .= $download_buttons;
		}
		$value_html .= '</div>';

		$item_data[] = array(
			'key'     => __( 'Horloge Photo 13', 'wc-photo-clock-13' ),
			'value'   => '',
			'display' => wp_kses_post( $value_html ),
		);

		return $item_data;
	}

	/**
	 * Détermine si une couleur est foncée.
	 *
	 * @param string $color Code couleur hex.
	 * @return bool
	 */
	private function is_color_dark( $color ) {
		$color = str_replace( '#', '', $color );
		$r = hexdec( substr( $color, 0, 2 ) );
		$g = hexdec( substr( $color, 2, 2 ) );
		$b = hexdec( substr( $color, 4, 2 ) );
		$brightness = ( $r * 299 + $g * 587 + $b * 114 ) / 1000;
		return $brightness < 128;
	}

	/**
	 * Enregistre les méta dans la commande.
	 *
	 * @param WC_Order_Item_Product $item Ligne commande.
	 * @param string                $cart_item_key Clé.
	 * @param array                 $values Valeurs panier.
	 * @param WC_Order              $order Commande.
	 */
	public function add_order_item_meta( $item, $cart_item_key, $values, $order ) {
		unset( $order );

		if ( empty( $values['wc_pc13'] ) || ! is_array( $values['wc_pc13'] ) ) {
			return;
		}

		// Encoder les données de configuration en JSON de manière sécurisée
		$config_json = wp_json_encode( $values['wc_pc13'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( false === $config_json ) {
			// Si l'encodage échoue, logger l'erreur mais continuer
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( 'WC_PC13: Failed to encode config JSON for order item' );
			}
			return;
		}

		$item->add_meta_data( 'wc_pc13_config', $config_json );

		if ( ! empty( $values['wc_pc13_preview'] ) && is_array( $values['wc_pc13_preview'] ) ) {
			$preview = $values['wc_pc13_preview'];
			$preview_json = wp_json_encode( $preview, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
			if ( false !== $preview_json ) {
				$item->add_meta_data( 'wc_pc13_preview', $preview_json );
			}

			$preview_url = '';
			if ( ! empty( $preview['url'] ) ) {
				$preview_url = esc_url( $preview['url'] );
			} elseif ( ! empty( $preview['id'] ) ) {
				$preview_url = esc_url( wp_get_attachment_url( absint( $preview['id'] ) ) );
			}

			if ( $preview_url ) {
				$item->add_meta_data(
					__( 'Aperçu JPEG', 'wc-photo-clock-13' ),
					sprintf(
						'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
						$preview_url,
						esc_html__( 'Télécharger l’aperçu', 'wc-photo-clock-13' )
					)
				);
			}
		}

		if ( ! empty( $values['wc_pc13_pdf'] ) && is_array( $values['wc_pc13_pdf'] ) ) {
			$pdf = $values['wc_pc13_pdf'];
			$pdf_json = wp_json_encode( $pdf, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
			if ( false !== $pdf_json ) {
				$item->add_meta_data( 'wc_pc13_pdf', $pdf_json );
			}

			$pdf_url = '';
			if ( ! empty( $pdf['url'] ) ) {
				$pdf_url = esc_url( $pdf['url'] );
			} elseif ( ! empty( $pdf['id'] ) ) {
				$pdf_url = esc_url( wp_get_attachment_url( absint( $pdf['id'] ) ) );
			}

			if ( $pdf_url ) {
				$item->add_meta_data(
					__( 'PDF HD', 'wc-photo-clock-13' ),
					sprintf(
						'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
						$pdf_url,
						esc_html__( 'Télécharger le PDF HD', 'wc-photo-clock-13' )
					)
				);
			}
		}
	}

	/**
	 * Nettoie les données.
	 *
	 * @param array $payload Données brutes.
	 *
	 * @return array
	 */
	public static function sanitize_payload( $payload ) {
		// Prix selon le diamètre
		$diameter_prices = array(
			30 => 49,
			40 => 59,
			50 => 69,
		);
		
		$diameter = isset( $payload['diameter'] ) ? absint( $payload['diameter'] ) : 40;
		if ( ! in_array( $diameter, array( 30, 40, 50 ), true ) ) {
			$diameter = 40; // Valeur par défaut
		}
		
		$second_hand = isset( $payload['second_hand'] ) ? sanitize_text_field( $payload['second_hand'] ) : 'black';
		if ( ! in_array( $second_hand, array( 'red', 'black', 'none' ), true ) ) {
			$second_hand = 'black';
		}
		
		$clean = array(
			'hands'  => isset( $payload['hands'] ) ? sanitize_text_field( $payload['hands'] ) : 'classic',
			'color'  => isset( $payload['color'] ) ? sanitize_hex_color( $payload['color'] ) : '#111111',
			'second_hand' => $second_hand,
			'diameter' => $diameter,
			'diameter_price' => isset( $diameter_prices[ $diameter ] ) ? $diameter_prices[ $diameter ] : 59,
			'slots'  => array(),
			'center' => array(),
			'ring_size' => isset( $payload['ring_size'] ) ? absint( $payload['ring_size'] ) : 110,
			'show_slots' => isset( $payload['show_slots'] ) ? (bool) $payload['show_slots'] : true,
			'show_numbers' => ! empty( $payload['show_numbers'] ),
			'numbers' => array(
				'color'    => '#222222',
				'size'     => 32,
				'distance' => 0,
			),
		);

		if ( ! empty( $payload['slots'] ) && is_array( $payload['slots'] ) ) {
			foreach ( $payload['slots'] as $index => $slot ) {
				$clean['slots'][ $index ] = array(
					'attachment_id' => isset( $slot['attachment_id'] ) ? absint( $slot['attachment_id'] ) : 0,
					'image_url'     => isset( $slot['image_url'] ) ? esc_url_raw( $slot['image_url'] ) : '',
					'x'             => isset( $slot['x'] ) ? floatval( $slot['x'] ) : 0,
					'y'             => isset( $slot['y'] ) ? floatval( $slot['y'] ) : 0,
					'scale'         => isset( $slot['scale'] ) ? floatval( $slot['scale'] ) : 1,
				);
			}
		}

		if ( ! empty( $payload['center'] ) && is_array( $payload['center'] ) ) {
			$clean['center'] = array(
				'attachment_id' => isset( $payload['center']['attachment_id'] ) ? absint( $payload['center']['attachment_id'] ) : 0,
				'image_url'     => isset( $payload['center']['image_url'] ) ? esc_url_raw( $payload['center']['image_url'] ) : '',
				'x'             => isset( $payload['center']['x'] ) ? floatval( $payload['center']['x'] ) : 0,
				'y'             => isset( $payload['center']['y'] ) ? floatval( $payload['center']['y'] ) : 0,
				'scale'         => isset( $payload['center']['scale'] ) ? floatval( $payload['center']['scale'] ) : 1,
				'size'          => isset( $payload['center']['size'] ) ? max( 120, min( 1000, absint( $payload['center']['size'] ) ) ) : 180,
			);
		}

		if ( ! empty( $payload['numbers'] ) && is_array( $payload['numbers'] ) ) {
			if ( ! empty( $payload['numbers']['color'] ) ) {
				$color = sanitize_hex_color( $payload['numbers']['color'] );
				if ( $color ) {
					$clean['numbers']['color'] = $color;
				}
			}

			if ( isset( $payload['numbers']['size'] ) ) {
				$size = absint( $payload['numbers']['size'] );
				if ( $size ) {
					$clean['numbers']['size'] = max( 12, min( 96, $size ) );
				}
			}

			if ( isset( $payload['numbers']['distance'] ) ) {
				$distance = absint( $payload['numbers']['distance'] );
				$clean['numbers']['distance'] = max( 0, min( 2000, $distance ) );
			} elseif ( isset( $payload['numbers']['offset'] ) ) {
				$distance = absint( $payload['numbers']['offset'] );
				$clean['numbers']['distance'] = max( 0, min( 2000, $distance ) );
			}
		}

		return $clean;
	}

	/**
	 * Gère l’upload d’un aperçu JPEG généré côté client.
	 */
	public function handle_preview_upload() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		if ( empty( $_FILES['preview'] ) || ! isset( $_FILES['preview']['tmp_name'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Aucun fichier reçu.', 'wc-photo-clock-13' ) ) );
		}

		$file = $_FILES['preview'];

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$file['name'] = sanitize_file_name( 'wc-pc13-preview-' . time() . '.jpg' );

		$uploaded = wp_handle_upload(
			$file,
			array(
				'test_form' => false,
			)
		);

		if ( isset( $uploaded['error'] ) ) {
			wp_send_json_error( array( 'message' => $uploaded['error'] ) );
		}

		if ( empty( $uploaded['type'] ) || 0 !== strpos( $uploaded['type'], 'image/' ) ) {
			if ( ! empty( $uploaded['file'] ) ) {
				@unlink( $uploaded['file'] );
			}
			wp_send_json_error( array( 'message' => __( 'Format de fichier invalide.', 'wc-photo-clock-13' ) ) );
		}

		$attachment = array(
			'post_mime_type' => $uploaded['type'],
			'post_title'     => sanitize_text_field( pathinfo( $uploaded['file'], PATHINFO_FILENAME ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attachment_id = wp_insert_attachment( $attachment, $uploaded['file'] );

		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $uploaded['file'] );
			wp_send_json_error( array( 'message' => $attachment_id->get_error_message() ) );
		}

		$metadata = wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] );
		wp_update_attachment_metadata( $attachment_id, $metadata );

		wp_send_json_success(
			array(
				'attachment_id' => $attachment_id,
				'url'           => wp_get_attachment_url( $attachment_id ),
			)
		);
	}

	/**
	 * Gère l’upload du PDF HD généré côté client.
	 */
	public function handle_pdf_upload() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		if ( empty( $_FILES['pdf'] ) || ! isset( $_FILES['pdf']['tmp_name'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Aucun fichier reçu.', 'wc-photo-clock-13' ) ) );
		}

		$file = $_FILES['pdf'];

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$file['name'] = sanitize_file_name( 'wc-pc13-preview-' . time() . '.pdf' );

		$uploaded = wp_handle_upload(
			$file,
			array(
				'test_form' => false,
			)
		);

		if ( isset( $uploaded['error'] ) ) {
			wp_send_json_error( array( 'message' => $uploaded['error'] ) );
		}

		if ( empty( $uploaded['type'] ) || 'application/pdf' !== $uploaded['type'] ) {
			if ( ! empty( $uploaded['file'] ) ) {
				@unlink( $uploaded['file'] );
			}
			wp_send_json_error( array( 'message' => __( 'Format de fichier invalide.', 'wc-photo-clock-13' ) ) );
		}

		$attachment = array(
			'post_mime_type' => $uploaded['type'],
			'post_title'     => sanitize_text_field( pathinfo( $uploaded['file'], PATHINFO_FILENAME ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attachment_id = wp_insert_attachment( $attachment, $uploaded['file'] );

		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $uploaded['file'] );
			wp_send_json_error( array( 'message' => $attachment_id->get_error_message() ) );
		}

		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] ) );

		wp_send_json_success(
			array(
				'attachment_id' => $attachment_id,
				'url'           => wp_get_attachment_url( $attachment_id ),
			)
		);
	}

	/**
	 * Remplace la vignette du panier par l’aperçu généré.
	 *
	 * @param string $thumbnail HTML par défaut.
	 * @param array  $cart_item Item du panier.
	 *
	 * @return string
	 */
	public function filter_cart_item_thumbnail( $thumbnail, $cart_item, $cart_item_key = null ) {
		if ( empty( $cart_item['wc_pc13_preview'] ) || ! is_array( $cart_item['wc_pc13_preview'] ) ) {
			return $thumbnail;
		}

		// Ne pas appliquer la vignette personnalisée dans le mini panier (widget)
		// Vérifier si on est dans un contexte de widget shopping cart
		$backtrace = debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, 15 );
		$is_widget_context = false;
		
		foreach ( $backtrace as $trace ) {
			if ( isset( $trace['function'] ) && (
				strpos( $trace['function'], 'widget_shopping_cart' ) !== false ||
				strpos( $trace['function'], 'woocommerce_mini_cart' ) !== false ||
				strpos( $trace['function'], 'WC_Widget' ) !== false ||
				( isset( $trace['class'] ) && (
					strpos( $trace['class'], 'Widget' ) !== false ||
					strpos( $trace['class'], 'WC_Widget_Shopping_Cart' ) !== false
				) )
			) ) {
				$is_widget_context = true;
				break;
			}
		}

		// Vérifier aussi via les actions en cours
		if ( ! $is_widget_context ) {
			$is_widget_context = (
				doing_action( 'woocommerce_widget_shopping_cart_before_buttons' ) ||
				doing_action( 'woocommerce_widget_shopping_cart_item_start' ) ||
				doing_action( 'woocommerce_mini_cart_contents' )
			);
		}

		// Si on est dans un widget (mini panier), retourner la vignette par défaut
		if ( $is_widget_context ) {
			return $thumbnail;
		}

		// Retourner notre vignette personnalisée (avec aiguilles, même logique que downloadAsJpeg)
		$html = $this->get_preview_thumbnail_html( $cart_item['wc_pc13_preview'] );

		// Retourner notre vignette uniquement, remplacer complètement la vignette par défaut
		return $html ? $html : $thumbnail;
	}

	/**
	 * Remplace la vignette dans les commandes (email/admin).
	 *
	 * @param string              $thumbnail HTML courant.
	 * @param WC_Order_Item_Product $item   Item commande.
	 *
	 * @return string
	 */
	public function filter_order_item_thumbnail( $thumbnail, $item_id, $item ) {
		unset( $item_id );

		if ( ! $item instanceof WC_Order_Item ) {
			return $thumbnail;
		}

		$meta = $item->get_meta( 'wc_pc13_preview', true );
		if ( empty( $meta ) ) {
			return $thumbnail;
		}

		$preview = json_decode( $meta, true );
		if ( empty( $preview ) || ! is_array( $preview ) ) {
			return $thumbnail;
		}

		$html = $this->get_preview_thumbnail_html( $preview );

		return $html ? $html : $thumbnail;
	}

	/**
	 * Génère le HTML de vignette d’aperçu.
	 *
	 * @param array  $preview Données d’aperçu.
	 * @param string $size    Taille d’image.
	 *
	 * @return string
	 */
	private function get_preview_thumbnail_html( $preview, $size = 'woocommerce_thumbnail' ) {
		if ( empty( $preview ) ) {
			return '';
		}

		// Si c'est une chaîne JSON, la décoder
		if ( is_string( $preview ) ) {
			$preview = json_decode( $preview, true );
		}

		if ( ! is_array( $preview ) ) {
			return '';
		}

		$attachment_id = ! empty( $preview['id'] ) ? absint( $preview['id'] ) : 0;
		$url           = ! empty( $preview['url'] ) ? esc_url( $preview['url'] ) : '';

		// Utiliser une taille WordPress optimisée pour la vignette du panier
		if ( $attachment_id ) {
			// Essayer d'abord la taille 'woocommerce_thumbnail' (généralement 300x300px)
			$thumbnail_url = wp_get_attachment_image_url( $attachment_id, 'woocommerce_thumbnail' );
			if ( $thumbnail_url ) {
				$url = $thumbnail_url;
			} else {
				// Fallback sur l'URL originale
				$url = wp_get_attachment_url( $attachment_id );
			}
		}

		if ( $url ) {
			// Générer une image carrée avec object-fit pour éviter la déformation
			return sprintf(
				'<img src="%s" alt="%s" class="wc-pc13-preview-thumb" style="width: 100%%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 8px;" />',
				esc_url( $url ),
				esc_attr__( 'Aperçu personnalisé', 'wc-photo-clock-13' )
			);
		}

		return '';
	}

	/**
	 * Masque le sélecteur de quantité pour les produits avec configurateur.
	 */
	public function hide_quantity_selector() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' === $enabled ) {
			echo '<style>.wc-pc13-configurator ~ .quantity, .wc-pc13-configurator ~ form .quantity, .product form.cart .quantity:has(+ .wc-pc13-configurator), form.cart:has(.wc-pc13-configurator) .quantity { display: none !important; }</style>';
		}
	}

	/**
	 * Fermeture du masquage du sélecteur de quantité.
	 */
	public function hide_quantity_selector_end() {
		// Le style est déjà ajouté dans hide_quantity_selector
	}
}


