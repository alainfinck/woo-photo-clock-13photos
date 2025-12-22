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
		// Hook spécifique pour le mini panier (widget)
		add_filter( 'woocommerce_widget_cart_item_thumbnail', array( $this, 'filter_cart_item_thumbnail' ), 10, 3 );
		// Filtrer le HTML du mini panier après génération pour s'assurer que la vignette est présente
		add_filter( 'woocommerce_add_to_cart_fragments', array( $this, 'filter_mini_cart_fragments' ), 20, 1 );
		add_action( 'woocommerce_before_calculate_totals', array( $this, 'apply_diameter_price' ), 20, 1 );
		add_filter( 'woocommerce_cart_item_price', array( $this, 'filter_cart_item_price' ), 10, 3 );
		add_action( 'woocommerce_before_add_to_cart_quantity', array( $this, 'hide_quantity_selector' ), 5 );
		add_action( 'woocommerce_after_add_to_cart_quantity', array( $this, 'hide_quantity_selector_end' ), 5 );
		add_action( 'wp_ajax_wc_pc13_send_help', array( $this, 'handle_help_request' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_send_help', array( $this, 'handle_help_request' ) );
		// Masquer les métadonnées du produit (Archives, Categories) pour les produits avec configurateur
		add_action( 'woocommerce_single_product_summary', array( $this, 'hide_product_meta' ), 99 );
		add_action( 'woocommerce_after_single_product_summary', array( $this, 'hide_product_meta_after' ), 1 );
		// Retirer le bouton "Ajouter au panier" natif pour les produits avec configurateur
		add_action( 'template_redirect', array( $this, 'remove_native_add_to_cart_button' ) );
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
		$mode             = $product->get_meta( '_wc_pc13_mode' );
		$default_show_slots = $product->get_meta( '_wc_pc13_default_show_slots' );

		$settings = class_exists( 'WC_PC13_Admin' ) ? WC_PC13_Admin::instance()->get_settings() : array(
			'default_color'    => '#111111',
		);

		// Par défaut, les photos périphériques sont activées si la meta n'existe pas
		$show_slots_value = $default_show_slots ? $default_show_slots : 'yes';

		$args = array(
			'product_id'       => $product->get_id(),
			'default_color'    => $default_color ? $default_color : $settings['default_color'],
			'mode'              => $mode ? $mode : 'peripheral',
			'default_show_slots' => 'yes' === $show_slots_value ? true : false,
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
		
		// Normaliser le code couleur (ajouter # si manquant)
		if ( substr( $color_code, 0, 1 ) !== '#' ) {
			$color_code = '#' . $color_code;
		}
		
		return isset( $color_map[ $color_code ] ) ? $color_map[ $color_code ] : $color_code;
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

		// Construire la liste des options point par point
		$options_list = array();
		
		// Diamètre avec prix
		if ( ! empty( $config['diameter'] ) ) {
			$diameter = absint( $config['diameter'] );
			$price = isset( $config['diameter_price'] ) ? floatval( $config['diameter_price'] ) : 59;
			$options_list[] = sprintf( 
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> %dcm - %s€</li>',
				esc_html__( 'Diamètre', 'wc-photo-clock-13' ),
				$diameter,
				number_format_i18n( $price, 0 )
			);
		}
		
		// Style et couleur des aiguilles
		if ( ! empty( $config['hands'] ) && ! empty( $config['color'] ) ) {
			$color_code = sanitize_hex_color( $config['color'] );
			$color_name = $this->get_color_name( $color_code );
			$hands_label = ucfirst( sanitize_text_field( $config['hands'] ) );
			$options_list[] = sprintf(
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> %s <span class="wc-pc13-cart-color-indicator" style="background-color: %s; display: inline-block; width: 12px; height: 12px; border-radius: 50%%; margin-left: 4px; vertical-align: middle;"></span> %s</li>',
				esc_html__( 'Aiguilles', 'wc-photo-clock-13' ),
				esc_html( $hands_label ),
				esc_attr( $color_code ),
				esc_html( $color_name )
			);
		} elseif ( ! empty( $config['hands'] ) ) {
			$options_list[] = sprintf(
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> %s</li>',
				esc_html__( 'Aiguilles', 'wc-photo-clock-13' ),
				esc_html( ucfirst( $config['hands'] ) )
			);
		} elseif ( ! empty( $config['color'] ) ) {
			$color_code = sanitize_hex_color( $config['color'] );
			$color_name = $this->get_color_name( $color_code );
			$options_list[] = sprintf(
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> <span class="wc-pc13-cart-color-indicator" style="background-color: %s; display: inline-block; width: 12px; height: 12px; border-radius: 50%%; margin-left: 4px; vertical-align: middle;"></span> %s</li>',
				esc_html__( 'Couleur des aiguilles', 'wc-photo-clock-13' ),
				esc_attr( $color_code ),
				esc_html( $color_name )
			);
		}

		// Trotteuse
		if ( ! empty( $config['second_hand'] ) ) {
			$second_hand_labels = array(
				'red' => esc_html__( 'Rouge', 'wc-photo-clock-13' ),
				'black' => esc_html__( 'Noir', 'wc-photo-clock-13' ),
				'none' => esc_html__( 'Pas de trotteuse', 'wc-photo-clock-13' ),
			);
			$second_hand_value = isset( $second_hand_labels[ $config['second_hand'] ] ) 
				? $second_hand_labels[ $config['second_hand'] ] 
				: esc_html( ucfirst( $config['second_hand'] ) );
			$options_list[] = sprintf(
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> %s</li>',
				esc_html__( 'Trotteuse', 'wc-photo-clock-13' ),
				$second_hand_value
			);
		}

		// Chiffres
		if ( array_key_exists( 'show_numbers', $config ) && wc_string_to_bool( $config['show_numbers'] ) ) {
			$number_type_labels = array(
				'arabic' => esc_html__( 'Arabes', 'wc-photo-clock-13' ),
				'roman' => esc_html__( 'Romains', 'wc-photo-clock-13' ),
			);
			$number_type = isset( $config['number_type'] ) && isset( $number_type_labels[ $config['number_type'] ] )
				? $number_type_labels[ $config['number_type'] ]
				: esc_html__( 'Arabes', 'wc-photo-clock-13' );
			
			$options_list[] = sprintf(
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> %s</li>',
				esc_html__( 'Chiffres', 'wc-photo-clock-13' ),
				$number_type
			);
		}

		// Photos
		$photo_summary = array();
		if ( $center_has_photo ) {
			$photo_summary[] = esc_html__( '1 photo centrale', 'wc-photo-clock-13' );
		}
		if ( $slots_with_photo > 0 ) {
			$photo_summary[] = sprintf( esc_html__( '%d photo(s) périphérique(s)', 'wc-photo-clock-13' ), $slots_with_photo );
		}
		if ( ! empty( $photo_summary ) ) {
			$options_list[] = sprintf(
				'<li class="wc-pc13-cart-option"><strong>%s:</strong> %s</li>',
				esc_html__( 'Photos', 'wc-photo-clock-13' ),
				implode( ', ', $photo_summary )
			);
		}

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
			$download_buttons = '<div class="wc-pc13-cart-download-buttons" style="margin-top: 8px;">';
			if ( $preview_url ) {
				$download_buttons .= '<a href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer" class="wc-pc13-cart-download-btn">' . esc_html__( 'Télécharger JPEG', 'wc-photo-clock-13' ) . '</a>';
			}
			if ( $pdf_url ) {
				$download_buttons .= '<a href="' . esc_url( $pdf_url ) . '" target="_blank" rel="noopener noreferrer" class="wc-pc13-cart-download-btn">' . esc_html__( 'Télécharger PDF HD', 'wc-photo-clock-13' ) . '</a>';
			}
			$download_buttons .= '</div>';
		}

		$value_html = '<div class="wc-pc13-cart-summary">';
		if ( ! empty( $options_list ) ) {
			$value_html .= '<ul class="wc-pc13-cart-options-list" style="list-style: none; padding: 0; margin: 0;">';
			$value_html .= implode( '', $options_list );
			$value_html .= '</ul>';
		}
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
		if ( empty( $values['wc_pc13'] ) || ! is_array( $values['wc_pc13'] ) ) {
			return;
		}

		// Marquer la commande comme contenant une horloge personnalisée
		$order->update_meta_data( '_wc_pc13_has_config', 'yes' );
		$order->save();

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
			60 => 89,
			70 => 109,
		);
		
		$diameter = isset( $payload['diameter'] ) ? absint( $payload['diameter'] ) : 40;
		if ( ! in_array( $diameter, array( 30, 40, 50, 60, 70 ), true ) ) {
			$diameter = 40; // Valeur par défaut
		}
		
		$second_hand = isset( $payload['second_hand'] ) ? sanitize_text_field( $payload['second_hand'] ) : 'black';
		if ( ! in_array( $second_hand, array( 'red', 'black', 'none' ), true ) ) {
			$second_hand = 'black';
		}
		
		$clean = array(
			'hands'  => isset( $payload['hands'] ) ? sanitize_text_field( $payload['hands'] ) : 'classic',
			'color'  => isset( $payload['color'] ) ? sanitize_hex_color( $payload['color'] ) : '#111111',
			'background_color' => isset( $payload['background_color'] ) ? sanitize_hex_color( $payload['background_color'] ) : '#fafafa',
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
				'number_type' => isset( $payload['numbers']['number_type'] ) ? sanitize_text_field( $payload['numbers']['number_type'] ) : 'arabic',
				'intermediate_points' => isset( $payload['numbers']['intermediate_points'] ) ? sanitize_text_field( $payload['numbers']['intermediate_points'] ) : 'without',
				'shadow' => array(
					'enabled'    => false,
					'intensity'  => 5,
				),
				'glow' => array(
					'enabled'    => false,
					'intensity'  => 10,
				),
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
					$clean['numbers']['size'] = max( 12, min( 150, $size ) );
				}
			}

			if ( isset( $payload['numbers']['distance'] ) ) {
				$distance = absint( $payload['numbers']['distance'] );
				$clean['numbers']['distance'] = max( 0, min( 2000, $distance ) );
			} elseif ( isset( $payload['numbers']['offset'] ) ) {
				$distance = absint( $payload['numbers']['offset'] );
				$clean['numbers']['distance'] = max( 0, min( 2000, $distance ) );
			}

			// Gérer le type de chiffres
			if ( isset( $payload['numbers']['number_type'] ) ) {
				$number_type = sanitize_text_field( $payload['numbers']['number_type'] );
				if ( in_array( $number_type, array( 'arabic', 'roman' ), true ) ) {
					$clean['numbers']['number_type'] = $number_type;
				}
			}

			// Gérer les points intermédiaires
			if ( isset( $payload['numbers']['intermediate_points'] ) ) {
				$intermediate_points = sanitize_text_field( $payload['numbers']['intermediate_points'] );
				if ( in_array( $intermediate_points, array( 'with', 'without' ), true ) ) {
					$clean['numbers']['intermediate_points'] = $intermediate_points;
				}
			}

			// Gérer l'ombre portée
			if ( isset( $payload['numbers']['shadow'] ) && is_array( $payload['numbers']['shadow'] ) ) {
				$clean['numbers']['shadow'] = array(
					'enabled'    => ! empty( $payload['numbers']['shadow']['enabled'] ),
					'intensity'  => isset( $payload['numbers']['shadow']['intensity'] ) ? max( 0, min( 20, absint( $payload['numbers']['shadow']['intensity'] ) ) ) : 5,
				);
			} else {
				$clean['numbers']['shadow'] = array(
					'enabled'    => false,
					'intensity'  => 5,
				);
			}

			// Gérer le halo lumineux
			if ( isset( $payload['numbers']['glow'] ) && is_array( $payload['numbers']['glow'] ) ) {
				$glow_color = isset( $payload['numbers']['glow']['color'] ) ? sanitize_hex_color( $payload['numbers']['glow']['color'] ) : null;
				if ( ! $glow_color ) {
					$glow_color = '#ffffff';
				}
				$clean['numbers']['glow'] = array(
					'enabled'    => ! empty( $payload['numbers']['glow']['enabled'] ),
					'intensity'  => isset( $payload['numbers']['glow']['intensity'] ) ? max( 1, min( 30, absint( $payload['numbers']['glow']['intensity'] ) ) ) : 1,
					'color'      => $glow_color,
				);
			} else {
				$clean['numbers']['glow'] = array(
					'enabled'    => false,
					'intensity'  => 1,
					'color'      => '#ffffff',
				);
			}

			// Compatibilité avec l'ancien format dial_style
			if ( isset( $payload['numbers']['dial_style'] ) && ! isset( $payload['numbers']['number_type'] ) ) {
				$dial_style = sanitize_text_field( $payload['numbers']['dial_style'] );
				// Convertir l'ancien format vers le nouveau
				if ( strpos( $dial_style, 'roman' ) !== false ) {
					$clean['numbers']['number_type'] = 'roman';
				} else {
					$clean['numbers']['number_type'] = 'arabic';
				}
				if ( $dial_style === 'dots' ) {
					$clean['numbers']['intermediate_points'] = 'with';
					$clean['numbers']['number_type'] = 'arabic';
				} elseif ( $dial_style === 'all' || $dial_style === 'roman-all' ) {
					$clean['numbers']['intermediate_points'] = 'without';
				} else {
					// Pour '12-4' et 'roman-12-4', on utilise 'with' (12, 3, 6, 9 avec points)
					$clean['numbers']['intermediate_points'] = 'with';
				}
			}
		}

		// Sauvegarder les styles des slots (bordure et ombre)
		if ( ! empty( $payload['slot_border'] ) && is_array( $payload['slot_border'] ) ) {
			$clean['slot_border'] = array(
				'enabled' => ! empty( $payload['slot_border']['enabled'] ),
				'width'   => isset( $payload['slot_border']['width'] ) ? max( 1, min( 10, absint( $payload['slot_border']['width'] ) ) ) : 2,
				'color'   => isset( $payload['slot_border']['color'] ) ? sanitize_hex_color( $payload['slot_border']['color'] ) : '#000000',
			);
		} else {
			$clean['slot_border'] = array(
				'enabled' => false,
				'width'   => 2,
				'color'   => '#000000',
			);
		}

		if ( ! empty( $payload['slot_shadow'] ) && is_array( $payload['slot_shadow'] ) ) {
			$clean['slot_shadow'] = array(
				'enabled' => ! empty( $payload['slot_shadow']['enabled'] ),
			);
		} else {
			$clean['slot_shadow'] = array(
				'enabled' => false,
			);
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
		// Vérifier si c'est un item avec configurateur
		if ( empty( $cart_item['wc_pc13_preview'] ) ) {
			return $thumbnail;
		}

		// Gérer différents formats de données
		$preview = $cart_item['wc_pc13_preview'];
		
		// Si c'est une chaîne JSON, la décoder
		if ( is_string( $preview ) ) {
			$preview = json_decode( $preview, true );
		}
		
		// Vérifier que c'est un tableau valide
		if ( ! is_array( $preview ) || ( empty( $preview['id'] ) && empty( $preview['url'] ) ) ) {
			return $thumbnail;
		}

		// Retourner notre vignette personnalisée pour le panier ET le mini panier
		$html = $this->get_preview_thumbnail_html( $preview, 'woocommerce_thumbnail' );

		// Retourner notre vignette uniquement, remplacer complètement la vignette par défaut
		return $html ? $html : $thumbnail;
	}

	/**
	 * Filtre les fragments du mini panier pour s'assurer que les vignettes sont présentes.
	 * Utilise une approche simple avec regex pour remplacer les vignettes manquantes.
	 *
	 * @param array $fragments Fragments du panier.
	 * @return array
	 */
	public function filter_mini_cart_fragments( $fragments ) {
		if ( empty( $fragments ) || ! is_array( $fragments ) ) {
			return $fragments;
		}

		// Récupérer le panier
		$cart = WC()->cart;
		if ( ! $cart ) {
			return $fragments;
		}

		$cart_items = $cart->get_cart();
		if ( empty( $cart_items ) ) {
			return $fragments;
		}

		// Parcourir tous les fragments pour trouver le mini panier
		foreach ( $fragments as $key => $html ) {
			if ( strpos( $key, 'widget_shopping_cart_content' ) !== false || strpos( $key, 'mini-cart' ) !== false ) {
				// Pour chaque item du panier, vérifier si la vignette est présente
				foreach ( $cart_items as $cart_item_key => $cart_item ) {
					if ( ! empty( $cart_item['wc_pc13_preview'] ) ) {
						$preview_html = $this->get_preview_thumbnail_html( $cart_item['wc_pc13_preview'], 'woocommerce_thumbnail' );
						
						if ( $preview_html ) {
							// Chercher le product-thumbnail pour cet item et le remplacer
							// Pattern pour trouver le thumbnail dans le HTML
							$pattern = '/(<div[^>]*class="[^"]*product-thumbnail[^"]*"[^>]*>)(.*?)(<\/div>)/is';
							
							// Si on trouve un product-thumbnail sans notre classe, le remplacer
							if ( preg_match( $pattern, $html, $matches ) ) {
								$thumbnail_content = $matches[2];
								// Vérifier si notre vignette n'est pas déjà présente
								if ( strpos( $thumbnail_content, 'wc-pc13-cart-clock-wrapper' ) === false ) {
									$new_thumbnail = $matches[1] . $preview_html . $matches[3];
									$html = str_replace( $matches[0], $new_thumbnail, $html );
								}
							}
						}
					}
				}
				
				$fragments[ $key ] = $html;
			}
		}

		return $fragments;
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
	 * Ajuste le prix dans le panier en fonction du diamètre choisi.
	 *
	 * @param WC_Cart $cart Panier courant.
	 */
	public function apply_diameter_price( $cart ) {
		if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
			return;
		}

		if ( ! $cart instanceof WC_Cart ) {
			return;
		}

		$diameter_prices = array(
			30 => 49,
			40 => 59,
			50 => 69,
			60 => 89,
			70 => 109,
		);

		foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
			if ( empty( $cart_item['wc_pc13'] ) || ! is_array( $cart_item['wc_pc13'] ) ) {
				continue;
			}

			if ( empty( $cart_item['data'] ) || ! $cart_item['data'] instanceof WC_Product ) {
				continue;
			}

			$config   = $cart_item['wc_pc13'];
			$diameter = isset( $config['diameter'] ) ? absint( $config['diameter'] ) : 0;

			$price = isset( $config['diameter_price'] ) ? floatval( $config['diameter_price'] ) : null;
			if ( null === $price && $diameter && isset( $diameter_prices[ $diameter ] ) ) {
				$price = $diameter_prices[ $diameter ];
				// Mémoriser pour l'affichage des badges/récapitulatif.
				$cart->cart_contents[ $cart_item_key ]['wc_pc13']['diameter_price'] = $price;
			}

			if ( null === $price ) {
				continue;
			}

			$cart_item['data']->set_price( $price );
			$cart->cart_contents[ $cart_item_key ] = $cart_item;
		}
	}

	/**
	 * Filtre le prix affiché dans le panier pour utiliser le prix du diamètre.
	 *
	 * @param string $price_html Prix HTML.
	 * @param array  $cart_item Item du panier.
	 * @param string $cart_item_key Clé de l'item.
	 * @return string
	 */
	public function filter_cart_item_price( $price_html, $cart_item, $cart_item_key ) {
		if ( empty( $cart_item['wc_pc13'] ) || ! is_array( $cart_item['wc_pc13'] ) ) {
			return $price_html;
		}

		$config = $cart_item['wc_pc13'];
		$price  = null;

		// Essayer de récupérer le prix depuis diameter_price
		if ( isset( $config['diameter_price'] ) ) {
			$price = floatval( $config['diameter_price'] );
		}

		// Si pas de prix, calculer depuis le diamètre
		if ( null === $price || $price <= 0 ) {
			$diameter_prices = array(
				30 => 49,
				40 => 59,
				50 => 69,
				60 => 89,
				70 => 109,
			);
			$diameter = isset( $config['diameter'] ) ? absint( $config['diameter'] ) : 0;
			if ( $diameter && isset( $diameter_prices[ $diameter ] ) ) {
				$price = $diameter_prices[ $diameter ];
			} else {
				return $price_html;
			}
		}

		return wc_price( $price );
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
			// Version améliorée avec bordure et ombre pour plus de visibilité
			// Utiliser une taille adaptée selon le contexte (mini cart ou panier complet)
			$wrapper_class = 'wc-pc13-cart-clock-wrapper';
			$img_class = 'wc-pc13-preview-thumb';
			
			return sprintf(
				'<div class="%s">
					<img src="%s" alt="%s" class="%s" />
				</div>',
				esc_attr( $wrapper_class ),
				esc_url( $url ),
				esc_attr__( 'Aperçu horloge personnalisée', 'wc-photo-clock-13' ),
				esc_attr( $img_class )
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

	/**
	 * Masque les métadonnées du produit (Archives, Categories) pour les produits avec configurateur.
	 */
	public function hide_product_meta() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' === $enabled ) {
			// Masquer les métadonnées via CSS
			add_action( 'wp_footer', array( $this, 'hide_product_meta_css' ), 999 );
		}
	}

	/**
	 * Masque les métadonnées après le résumé du produit.
	 */
	public function hide_product_meta_after() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' === $enabled ) {
			// Masquer via remove_action pour les hooks WooCommerce
			remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_meta', 40 );
			remove_action( 'woocommerce_after_single_product_summary', 'woocommerce_output_product_data_tabs', 10 );
		}
	}

	/**
	 * Retire le bouton "Ajouter au panier" natif pour les produits avec configurateur.
	 */
	public function remove_native_add_to_cart_button() {
		if ( ! is_product() ) {
			return;
		}

		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' === $enabled ) {
			// Retirer le hook qui affiche le bouton "Ajouter au panier"
			remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );
			// Retirer aussi pour les thèmes qui utilisent d'autres hooks
			remove_action( 'woocommerce_after_single_product_summary', 'woocommerce_template_single_add_to_cart', 5 );
			// Ajouter un filtre pour masquer le bouton via CSS
			add_action( 'wp_head', array( $this, 'hide_native_button_css' ), 999 );
		}
	}

	/**
	 * Ajoute le CSS pour masquer le bouton natif.
	 */
	public function hide_native_button_css() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' === $enabled ) {
			echo '<style>
				.single-product .single_add_to_cart_button:not(.wc-pc13-add-to-cart-btn),
				.add-to-cart-container .single_add_to_cart_button:not(.wc-pc13-add-to-cart-btn),
				form.cart .single_add_to_cart_button:not(.wc-pc13-add-to-cart-btn) {
					display: none !important;
					visibility: hidden !important;
					opacity: 0 !important;
					position: absolute !important;
					width: 0 !important;
					height: 0 !important;
					overflow: hidden !important;
					pointer-events: none !important;
				}
			</style>';
		}
	}

	/**
	 * Ajoute le CSS pour masquer les métadonnées.
	 */
	public function hide_product_meta_css() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$enabled = $product->get_meta( '_wc_pc13_enabled' );
		if ( 'yes' === $enabled ) {
			echo '<style>
				.single-product .product_meta,
				.single-product .entry-meta,
				.single-product .product_meta-wrapper,
				.single-product .entry-meta-wrapper,
				.single-product .product-meta,
				.single-product .entry-footer,
				.single-product .entry-footer .posted-on,
				.single-product .entry-footer .cat-links,
				.single-product .entry-footer .tags-links,
				.single-product .posted_in,
				.single-product .tagged_as,
				.single-product .product_meta .posted_in,
				.single-product .product_meta .tagged_as,
				.single-product .entry-meta .posted-on,
				.single-product .entry-meta .cat-links,
				.single-product .product-meta .posted_in,
				.single-product .product-meta .tagged_as {
					display: none !important;
				}
			</style>';
		}
	}

	/**
	 * Gère l'envoi d'une demande d'aide ou de signalement de bug.
	 */
	public function handle_help_request() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$type    = isset( $_POST['type'] ) ? sanitize_text_field( wp_unslash( $_POST['type'] ) ) : '';
		$email   = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '';
		$subject = isset( $_POST['subject'] ) ? sanitize_text_field( wp_unslash( $_POST['subject'] ) ) : '';
		$message = isset( $_POST['message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['message'] ) ) : '';

		if ( empty( $type ) || empty( $email ) || empty( $subject ) || empty( $message ) ) {
			wp_send_json_error( array( 'message' => __( 'Tous les champs sont requis.', 'wc-photo-clock-13' ) ) );
		}

		if ( ! is_email( $email ) ) {
			wp_send_json_error( array( 'message' => __( 'Adresse email invalide.', 'wc-photo-clock-13' ) ) );
		}

		// Email de destination
		$admin_email = 'contact@mohorloge.fr';

		// Préparer le sujet de l'email
		$email_subject = sprintf(
			'[%s] %s: %s',
			get_bloginfo( 'name' ),
			$type === 'bug' ? __( 'Signalement de bug', 'wc-photo-clock-13' ) : __( 'Question', 'wc-photo-clock-13' ),
			$subject
		);

		// Préparer le corps de l'email
		$email_body = sprintf(
			"%s\n\n%s: %s\n\n%s:\n%s\n\n%s:\n%s\n\n%s:\n%s",
			$type === 'bug' ? __( 'Un bug a été signalé via le configurateur d\'horloge.', 'wc-photo-clock-13' ) : __( 'Une question a été posée via le configurateur d\'horloge.', 'wc-photo-clock-13' ),
			__( 'Type', 'wc-photo-clock-13' ),
			$type === 'bug' ? __( 'Bug', 'wc-photo-clock-13' ) : __( 'Question', 'wc-photo-clock-13' ),
			__( 'Email', 'wc-photo-clock-13' ),
			$email,
			__( 'Sujet', 'wc-photo-clock-13' ),
			$subject,
			__( 'Message', 'wc-photo-clock-13' ),
			$message
		);

		// En-têtes de l'email
		$headers = array(
			'Content-Type: text/plain; charset=UTF-8',
			'From: ' . get_bloginfo( 'name' ) . ' <' . $admin_email . '>',
			'Reply-To: ' . $email,
		);

		// Envoyer l'email
		$sent = wp_mail( $admin_email, $email_subject, $email_body, $headers );

		if ( $sent ) {
			wp_send_json_success( array( 'message' => __( 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.', 'wc-photo-clock-13' ) ) );
		} else {
			wp_send_json_error( array( 'message' => __( 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer plus tard.', 'wc-photo-clock-13' ) ) );
		}
	}
}


