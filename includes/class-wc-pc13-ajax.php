<?php
/**
 * Gestion des appels AJAX.
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_PC13_Ajax {

	/**
	 * Instance.
	 *
	 * @var WC_PC13_Ajax|null
	 */
	protected static $instance = null;

	/**
	 * Singleton.
	 *
	 * @return WC_PC13_Ajax
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
		add_action( 'wp_ajax_wc_pc13_upload_image', array( $this, 'handle_upload' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_upload_image', array( $this, 'handle_upload' ) );
		add_action( 'wp_ajax_wc_pc13_delete_image', array( $this, 'handle_delete' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_delete_image', array( $this, 'handle_delete' ) );
		add_action( 'wp_ajax_wc_pc13_fetch_unsplash', array( $this, 'handle_fetch_unsplash' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_fetch_unsplash', array( $this, 'handle_fetch_unsplash' ) );
		add_action( 'wp_ajax_wc_pc13_add_to_cart', array( $this, 'handle_add_to_cart' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_add_to_cart', array( $this, 'handle_add_to_cart' ) );
		add_action( 'wp_ajax_wc_pc13_save_share', array( $this, 'handle_save_share' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_save_share', array( $this, 'handle_save_share' ) );
		add_action( 'wp_ajax_wc_pc13_load_share', array( $this, 'handle_load_share' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_load_share', array( $this, 'handle_load_share' ) );
		add_action( 'wp_ajax_wc_pc13_save_share_email', array( $this, 'handle_save_share_email' ) );
		add_action( 'wp_ajax_nopriv_wc_pc13_save_share_email', array( $this, 'handle_save_share_email' ) );
	}

	/**
	 * Traitement de l’upload.
	 */
	public function handle_upload() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		if ( empty( $_FILES['file'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Aucun fichier reçu.', 'wc-photo-clock-13' ) ) );
		}

		$file = $_FILES['file'];

		if ( $file['error'] ) {
			wp_send_json_error( array( 'message' => __( 'Erreur lors de l’upload.', 'wc-photo-clock-13' ) ) );
		}

		$settings = class_exists( 'WC_PC13_Admin' ) ? WC_PC13_Admin::instance()->get_settings() : array(
			'max_upload_size' => 10,
			'thumb_max_size'  => 2000,
		);
		$max_size_bytes = absint( $settings['max_upload_size'] ) * 1024 * 1024;
		$thumb_max_size = isset( $settings['thumb_max_size'] ) ? absint( $settings['thumb_max_size'] ) : 2000;
		if ( $thumb_max_size < 200 ) {
			$thumb_max_size = 200;
		}

		if ( $max_size_bytes && $file['size'] > $max_size_bytes ) {
			wp_send_json_error(
				array(
					'message' => sprintf(
						/* translators: %s: valeur numérique en Mo. */
						__( 'Le fichier dépasse la taille maximale autorisée (%s Mo).', 'wc-photo-clock-13' ),
						number_format_i18n( $settings['max_upload_size'] )
					),
				)
			);
		}

		// Autoriser uniquement les images.
		$allowed_types = array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' );
		if ( ! in_array( $file['type'], $allowed_types, true ) ) {
			wp_send_json_error( array( 'message' => __( 'Format de fichier non pris en charge.', 'wc-photo-clock-13' ) ) );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$uploaded = wp_handle_upload(
			$file,
			array(
				'test_form' => false,
			)
		);

		if ( isset( $uploaded['error'] ) ) {
			wp_send_json_error( array( 'message' => $uploaded['error'] ) );
		}

		$attachment = array(
			'post_mime_type' => $uploaded['type'],
			'post_title'     => sanitize_file_name( basename( $uploaded['file'] ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attachment_id = wp_insert_attachment( $attachment, $uploaded['file'] );

		if ( ! is_wp_error( $attachment_id ) ) {
			$metadata = wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] );
			wp_update_attachment_metadata( $attachment_id, $metadata );
		}

		// Créer une vignette redimensionnée (max côté = $thumb_max_size)
		$thumb_url = $uploaded['url'];
		if ( ! is_wp_error( $attachment_id ) ) {
			$image_editor = wp_get_image_editor( $uploaded['file'] );
			if ( ! is_wp_error( $image_editor ) ) {
				$image_editor->resize( $thumb_max_size, $thumb_max_size, false );
				$saved = $image_editor->save();
				if ( ! is_wp_error( $saved ) && ! empty( $saved['path'] ) ) {
					$upload_dir = wp_upload_dir();
					if ( ! empty( $saved['file'] ) ) {
						$thumb_url = trailingslashit( $upload_dir['baseurl'] ) . $saved['file'];
					}
				}
			}
		}

		wp_send_json_success(
			array(
				'url'           => $thumb_url,
				'full_url'      => $uploaded['url'],
				'attachment_id' => $attachment_id,
			)
		);
	}

	/**
	 * Suppression éventuelle des images.
	 */
	public function handle_delete() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( wp_unslash( $_POST['attachment_id'] ) ) : 0;

		if ( ! $attachment_id ) {
			wp_send_json_error( array( 'message' => __( 'ID de fichier manquant.', 'wc-photo-clock-13' ) ) );
		}

		if ( get_post( $attachment_id ) ) {
			wp_delete_attachment( $attachment_id, true );
		}

		wp_send_json_success();
	}

	/**
	 * Récupère des images aléatoires depuis Unsplash.
	 */
	public function handle_fetch_unsplash() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$count = isset( $_POST['count'] ) ? absint( $_POST['count'] ) : 13;
		$count = min( $count, 13 ); // Maximum 13 images

		$access_key = 'p9RniMVfR7MiCI-YC8pDpM9zob_a4fOyMQzmcDAIPVY';
		$url        = sprintf( 'https://api.unsplash.com/photos/random?count=%d&client_id=%s', $count, $access_key );

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 15,
				'headers' => array(
					'Accept-Version' => 'v1',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$error_message = $response->get_error_message();
			wp_send_json_error( 
				array( 
					'message' => sprintf(
						/* translators: %s: error message */
						__( 'Erreur lors de la récupération des images Unsplash: %s', 'wc-photo-clock-13' ),
						$error_message
					)
				) 
			);
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $response_code ) {
			$body = wp_remote_retrieve_body( $response );
			wp_send_json_error( 
				array( 
					'message' => sprintf(
						/* translators: %d: HTTP status code, %s: response body */
						__( 'Erreur HTTP %d lors de la récupération des images Unsplash: %s', 'wc-photo-clock-13' ),
						$response_code,
						$body
					)
				) 
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( ! is_array( $data ) || empty( $data ) ) {
			wp_send_json_error( 
				array( 
					'message' => __( 'Aucune image récupérée depuis Unsplash.', 'wc-photo-clock-13' ),
					'debug' => $body
				) 
			);
		}

		$images = array();
		foreach ( $data as $photo ) {
			// Utiliser 'small' au lieu de 'regular' pour des images moins lourdes (environ 400px au lieu de 1080px)
			if ( isset( $photo['urls']['small'] ) ) {
				$images[] = array(
					'url' => $photo['urls']['small'],
					'thumb' => isset( $photo['urls']['thumb'] ) ? $photo['urls']['thumb'] : $photo['urls']['small'],
				);
			} elseif ( isset( $photo['urls']['regular'] ) ) {
				// Fallback sur regular si small n'est pas disponible
				$images[] = array(
					'url' => $photo['urls']['regular'],
					'thumb' => isset( $photo['urls']['thumb'] ) ? $photo['urls']['thumb'] : $photo['urls']['regular'],
				);
			}
		}

		if ( empty( $images ) ) {
			wp_send_json_error( array( 'message' => __( 'Aucune image valide récupérée.', 'wc-photo-clock-13' ) ) );
		}

		wp_send_json_success( array( 'images' => $images ) );
	}

	/**
	 * Ajoute le produit au panier via AJAX.
	 */
	public function handle_add_to_cart() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
		$quantity   = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;
		$payload    = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';
		$preview_id = isset( $_POST['preview_id'] ) ? absint( $_POST['preview_id'] ) : 0;
		$preview_url = isset( $_POST['preview_url'] ) ? esc_url_raw( $_POST['preview_url'] ) : '';
		$pdf_id     = isset( $_POST['pdf_id'] ) ? absint( $_POST['pdf_id'] ) : 0;
		$pdf_url    = isset( $_POST['pdf_url'] ) ? esc_url_raw( $_POST['pdf_url'] ) : '';

		if ( ! $product_id ) {
			wp_send_json_error( array( 'message' => __( 'ID produit manquant.', 'wc-photo-clock-13' ) ) );
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			wp_send_json_error( array( 'message' => __( 'Produit introuvable.', 'wc-photo-clock-13' ) ) );
		}

		// Préparer les données de configuration
		$cart_item_data = array();
		if ( $payload ) {
			// Décoder le payload JSON et le nettoyer comme dans add_cart_item_data
			$payload_decoded = json_decode( wp_unslash( $payload ), true );
			if ( ! empty( $payload_decoded ) && is_array( $payload_decoded ) ) {
				$cart_item_data['wc_pc13'] = WC_PC13_Frontend::sanitize_payload( $payload_decoded );
			}
		}

		if ( $preview_id || $preview_url ) {
			$preview_data = array();
			if ( $preview_id ) {
				$preview_data['id'] = $preview_id;
			}
			if ( $preview_url ) {
				$preview_data['url'] = $preview_url;
			}
			// Stocker comme array pour compatibilité avec filter_cart_item_thumbnail
			$cart_item_data['wc_pc13_preview'] = $preview_data;
		}

		if ( $pdf_id || $pdf_url ) {
			$pdf_data = array();
			if ( $pdf_id ) {
				$pdf_data['id'] = $pdf_id;
			}
			if ( $pdf_url ) {
				$pdf_data['url'] = $pdf_url;
			}
			// Stocker comme array pour compatibilité
			$cart_item_data['wc_pc13_pdf'] = $pdf_data;
		}

		// Force item unique (comme dans add_cart_item_data)
		$cart_item_data['unique_key'] = md5( microtime() . rand() );

		// Ajouter au panier
		$cart_item_key = WC()->cart->add_to_cart( $product_id, $quantity, 0, array(), $cart_item_data );

		if ( ! $cart_item_key ) {
			wp_send_json_error( array( 'message' => __( 'Impossible d\'ajouter le produit au panier.', 'wc-photo-clock-13' ) ) );
		}

		// Récupérer l'URL de l'image de prévisualisation pour la notification
		$preview_image_url = '';
		if ( $preview_id ) {
			$preview_image_url = wp_get_attachment_image_url( $preview_id, 'thumbnail' );
		} elseif ( $preview_url ) {
			$preview_image_url = $preview_url;
		}

		// Calculer le nombre d'articles dans le panier
		$cart_count = WC()->cart->get_cart_contents_count();

		wp_send_json_success(
			array(
				'message'      => __( 'Produit ajouté au panier avec succès.', 'wc-photo-clock-13' ),
				'cart_count'   => $cart_count,
				'preview_url'  => $preview_image_url,
				'product_name' => $product->get_name(),
			)
		);
	}

	/**
	 * Sauvegarde une configuration pour le partage.
	 */
	public function handle_save_share() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
		$payload    = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';

		if ( ! $product_id ) {
			wp_send_json_error( array( 'message' => __( 'ID produit manquant.', 'wc-photo-clock-13' ) ) );
		}

		if ( ! $payload || empty( trim( $payload ) ) ) {
			wp_send_json_error( array( 'message' => __( 'Configuration manquante.', 'wc-photo-clock-13' ) ) );
		}

		// Décoder le JSON (pas besoin de wp_unslash car déjà fait)
		$payload_decoded = json_decode( $payload, true );
		if ( ! is_array( $payload_decoded ) || json_last_error() !== JSON_ERROR_NONE ) {
			wp_send_json_error( 
				array( 
					'message' => __( 'Configuration invalide.', 'wc-photo-clock-13' ),
					'debug' => json_last_error_msg()
				) 
			);
		}

		// Générer un identifiant unique
		$share_id = wp_generate_password( 32, false );
		
		// Nettoyer la configuration
		$config = WC_PC13_Frontend::sanitize_payload( $payload_decoded );
		
		// Sauvegarder dans un transient (valide 30 jours)
		$data = array(
			'product_id' => $product_id,
			'config'     => $config,
			'created_at' => current_time( 'mysql' ),
		);
		
		$transient_key = 'wc_pc13_share_' . $share_id;
		set_transient( $transient_key, $data, 30 * DAY_IN_SECONDS );

		// Générer l'URL de partage
		$share_url = add_query_arg(
			array(
				'share' => $share_id,
			),
			get_permalink( $product_id )
		);

		wp_send_json_success(
			array(
				'share_id'  => $share_id,
				'share_url' => $share_url,
			)
		);
	}

	/**
	 * Sauvegarde une configuration et envoie le lien par email.
	 */
	public function handle_save_share_email() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$email      = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '';
		$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
		$payload    = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';

		if ( ! $product_id ) {
			wp_send_json_error( array( 'message' => __( 'ID produit manquant.', 'wc-photo-clock-13' ) ) );
		}

		if ( ! is_email( $email ) ) {
			wp_send_json_error( array( 'message' => __( 'Email invalide.', 'wc-photo-clock-13' ) ) );
		}

		if ( ! $payload || empty( trim( $payload ) ) ) {
			wp_send_json_error( array( 'message' => __( 'Configuration manquante.', 'wc-photo-clock-13' ) ) );
		}

		$payload_decoded = json_decode( $payload, true );
		if ( ! is_array( $payload_decoded ) || json_last_error() !== JSON_ERROR_NONE ) {
			wp_send_json_error(
				array(
					'message' => __( 'Configuration invalide.', 'wc-photo-clock-13' ),
					'debug'   => json_last_error_msg(),
				)
			);
		}

		// Réutiliser la logique de sauvegarde (transient + URL)
		$share_id = wp_generate_password( 32, false );
		$config   = WC_PC13_Frontend::sanitize_payload( $payload_decoded );

		$data = array(
			'product_id' => $product_id,
			'config'     => $config,
			'created_at' => current_time( 'mysql' ),
		);

		$transient_key = 'wc_pc13_share_' . $share_id;
		set_transient( $transient_key, $data, 30 * DAY_IN_SECONDS );

		$share_url = add_query_arg(
			array(
				'share' => $share_id,
			),
			get_permalink( $product_id )
		);

		// Envoyer l'email
		$subject = sprintf( __( 'Votre lien de sauvegarde - %s', 'wc-photo-clock-13' ), get_bloginfo( 'name' ) );
		$body    = sprintf(
			/* translators: %s: share URL */
			__( "Bonjour,\n\nVoici le lien pour reprendre votre composition : %s\n\nÀ bientôt !", 'wc-photo-clock-13' ),
			$share_url
		);

		$sent = wp_mail( $email, $subject, $body );
		if ( ! $sent ) {
			wp_send_json_error( array( 'message' => __( 'Erreur lors de l’envoi de l’email.', 'wc-photo-clock-13' ) ) );
		}

		// Enregistrer le partage + email collecté
		$share_emails = get_option( 'wc_pc13_share_emails', array() );
		if ( ! is_array( $share_emails ) ) {
			$share_emails = array();
		}
		$share_emails[] = array(
			'share_id'   => $share_id,
			'product_id' => $product_id,
			'email'      => $email,
			'created_at' => current_time( 'mysql' ),
			'share_url'  => $share_url,
		);
		update_option( 'wc_pc13_share_emails', $share_emails, false );

		wp_send_json_success(
			array(
				'share_id'  => $share_id,
				'share_url' => $share_url,
			)
		);
	}

	/**
	 * Charge une configuration partagée.
	 */
	public function handle_load_share() {
		check_ajax_referer( 'wc_pc13_nonce', 'nonce' );

		$share_id = isset( $_POST['share_id'] ) ? sanitize_text_field( wp_unslash( $_POST['share_id'] ) ) : '';

		if ( ! $share_id ) {
			wp_send_json_error( array( 'message' => __( 'ID de partage manquant.', 'wc-photo-clock-13' ) ) );
		}

		$transient_key = 'wc_pc13_share_' . $share_id;
		$data = get_transient( $transient_key );

		if ( false === $data ) {
			wp_send_json_error( array( 'message' => __( 'Configuration partagée introuvable ou expirée.', 'wc-photo-clock-13' ) ) );
		}

		if ( ! is_array( $data ) || ! isset( $data['config'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Configuration invalide.', 'wc-photo-clock-13' ) ) );
		}

		wp_send_json_success(
			array(
				'config'     => $data['config'],
				'product_id' => isset( $data['product_id'] ) ? absint( $data['product_id'] ) : 0,
			)
		);
	}
}


