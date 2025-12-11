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
			$color_display = sanitize_hex_color( $data['color'] );
			echo '<div style="padding:8px;background:#fff;border-radius:4px;border:1px solid #e0e0e0;"><strong>' . esc_html__( 'Couleur', 'wc-photo-clock-13' ) . ':</strong><br><span style="display:inline-block;width:20px;height:20px;background:' . esc_attr( $color_display ) . ';border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:5px;"></span><span style="color:#666;">' . esc_html( $color_display ) . '</span></div>';
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

		$preview_meta = $item->get_meta( 'wc_pc13_preview', true );
		if ( $preview_meta ) {
			$preview_data = json_decode( $preview_meta, true );
			$preview_url  = '';
			if ( ! empty( $preview_data['url'] ) ) {
				$preview_url = esc_url( $preview_data['url'] );
			} elseif ( ! empty( $preview_data['id'] ) ) {
				$preview_url = esc_url( wp_get_attachment_url( absint( $preview_data['id'] ) ) );
			}
			if ( $preview_url ) {
				echo '<p><a class="button" href="' . esc_url( $preview_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger l’aperçu JPEG', 'wc-photo-clock-13' ) . '</a></p>';
			}
		}

		$pdf_meta = $item->get_meta( 'wc_pc13_pdf', true );
		if ( $pdf_meta ) {
			$pdf_data = json_decode( $pdf_meta, true );
			$pdf_url  = '';
			if ( ! empty( $pdf_data['url'] ) ) {
				$pdf_url = esc_url( $pdf_data['url'] );
			} elseif ( ! empty( $pdf_data['id'] ) ) {
				$pdf_url = esc_url( wp_get_attachment_url( absint( $pdf_data['id'] ) ) );
			}
			if ( $pdf_url ) {
				echo '<p><a class="button" href="' . esc_url( $pdf_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Télécharger le PDF HD', 'wc-photo-clock-13' ) . '</a></p>';
			}
		}

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


