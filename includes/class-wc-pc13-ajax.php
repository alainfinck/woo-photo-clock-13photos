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

		// Vérifier les limites PHP avant l'upload
		$upload_max_filesize = wp_max_upload_size();
		
		// Vérifier que le fichier ne dépasse pas les limites PHP
		if ( $file['size'] > $upload_max_filesize ) {
			wp_send_json_error( array( 
				'message' => sprintf(
					/* translators: %s: taille maximale */
					__( 'Le fichier dépasse la limite PHP (upload_max_filesize: %s).', 'wc-photo-clock-13' ),
					size_format( $upload_max_filesize )
				)
			) );
		}

		// Augmenter temporairement la limite de mémoire si nécessaire
		$current_memory_limit = $this->parse_size( ini_get( 'memory_limit' ) );
		if ( $current_memory_limit > 0 ) {
			$estimated_memory_needed = $file['size'] * 3; // Estimation: 3x la taille du fichier pour le traitement
			if ( $estimated_memory_needed > $current_memory_limit ) {
				$new_memory_limit = max( 256, ceil( $estimated_memory_needed / 1024 / 1024 ) * 1.5 ); // 50% de marge, minimum 256M
				@ini_set( 'memory_limit', $new_memory_limit . 'M' );
			}
		}

		try {
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

			if ( is_wp_error( $attachment_id ) ) {
				wp_send_json_error( array( 'message' => $attachment_id->get_error_message() ) );
			}

			if ( $attachment_id > 0 ) {
				// Générer les métadonnées avec gestion d'erreur
				$metadata = wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] );
				if ( is_wp_error( $metadata ) ) {
					// Si la génération des métadonnées échoue, continuer quand même
					error_log( 'WC_PC13: Erreur génération métadonnées: ' . $metadata->get_error_message() );
				} else {
					wp_update_attachment_metadata( $attachment_id, $metadata );
				}
			}
		} catch ( Exception $e ) {
			wp_send_json_error( array( 
				'message' => sprintf(
					/* translators: %s: message d'erreur */
					__( 'Erreur lors du traitement du fichier: %s', 'wc-photo-clock-13' ),
					$e->getMessage()
				)
			) );
		}

		// Utiliser wp_get_attachment_url pour obtenir l'URL correcte de l'image originale
		$full_url = $uploaded['url'];
		if ( ! is_wp_error( $attachment_id ) && $attachment_id > 0 ) {
			$attachment_url = wp_get_attachment_url( $attachment_id );
			if ( $attachment_url ) {
				$full_url = $attachment_url;
			}
		}

		// Récupérer le slot pour déterminer si c'est une photo périphérique
		$slot = isset( $_POST['slot'] ) ? sanitize_text_field( wp_unslash( $_POST['slot'] ) ) : '';
		$is_peripheral = false;
		if ( $slot && $slot !== 'center' && $slot !== 'Centre' ) {
			$slot_num = absint( $slot );
			if ( $slot_num >= 1 && $slot_num <= 12 ) {
				$is_peripheral = true;
			}
		}

		// Créer une vignette redimensionnée pour les photos périphériques (max 2000px)
		$thumb_url = $full_url;
		if ( $attachment_id > 0 && $is_peripheral ) {
			// Créer une vignette de 2000px max pour les photos périphériques
			$thumb_url = $this->create_peripheral_thumbnail( $attachment_id, $uploaded['file'], $thumb_max_size );
			if ( ! $thumb_url ) {
				$thumb_url = $full_url;
			}
		} elseif ( $attachment_id > 0 ) {
			// Pour les autres images (centre), utiliser les tailles WordPress standard
			$thumb_url = wp_get_attachment_image_url( $attachment_id, 'medium' );
			if ( ! $thumb_url ) {
				$thumb_url = wp_get_attachment_image_url( $attachment_id, 'thumbnail' );
			}
			if ( ! $thumb_url ) {
				$thumb_url = $full_url;
			}
		}

		// S'assurer que thumb_url est valide, sinon utiliser full_url
		if ( empty( $thumb_url ) ) {
			$thumb_url = $full_url;
		}

		wp_send_json_success(
			array(
				'url'           => $thumb_url,
				'full_url'      => $full_url,
				'attachment_id' => $attachment_id,
			)
		);
	}

	/**
	 * Crée une vignette optimisée pour les photos périphériques (max 2000px).
	 *
	 * @param int    $attachment_id ID de l'attachment.
	 * @param string $file_path     Chemin du fichier original.
	 * @param int    $max_size      Taille maximale en pixels (défaut: 2000).
	 * @return string|false URL de la vignette ou false en cas d'erreur.
	 */
	private function create_peripheral_thumbnail( $attachment_id, $file_path, $max_size = 2000 ) {
		if ( ! $attachment_id || ! file_exists( $file_path ) ) {
			return false;
		}

		// Obtenir les dimensions de l'image originale
		$image_meta = wp_get_attachment_metadata( $attachment_id );
		if ( ! $image_meta || ! isset( $image_meta['width'] ) || ! isset( $image_meta['height'] ) ) {
			// Si les métadonnées ne sont pas disponibles, les lire depuis le fichier
			$image_info = wp_getimagesize( $file_path );
			if ( ! $image_info ) {
				return false;
			}
			$original_width  = $image_info[0];
			$original_height = $image_info[1];
		} else {
			$original_width  = $image_meta['width'];
			$original_height = $image_meta['height'];
		}

		// Si l'image est déjà plus petite que max_size, retourner l'URL originale
		if ( $original_width <= $max_size && $original_height <= $max_size ) {
			return wp_get_attachment_url( $attachment_id );
		}

		// Calculer les nouvelles dimensions en conservant le ratio
		$ratio = min( $max_size / $original_width, $max_size / $original_height );
		$new_width  = (int) round( $original_width * $ratio );
		$new_height = (int) round( $original_height * $ratio );

		// Vérifier si une vignette de cette taille existe déjà
		$upload_dir = wp_upload_dir();
		$file_info  = pathinfo( $file_path );
		$thumb_filename = $file_info['filename'] . '-pc13-' . $max_size . '.' . $file_info['extension'];
		$thumb_path = $file_info['dirname'] . '/' . $thumb_filename;
		
		// Construire l'URL relative depuis le répertoire d'upload
		$relative_path = str_replace( $upload_dir['basedir'], '', $thumb_path );
		$thumb_url = $upload_dir['baseurl'] . $relative_path;

		// Si la vignette existe déjà, retourner son URL
		if ( file_exists( $thumb_path ) ) {
			return $thumb_url;
		}

		// Charger l'image selon son type
		$image = false;
		$mime_type = get_post_mime_type( $attachment_id );
		
		switch ( $mime_type ) {
			case 'image/jpeg':
				$image = imagecreatefromjpeg( $file_path );
				break;
			case 'image/png':
				$image = imagecreatefrompng( $file_path );
				break;
			case 'image/gif':
				$image = imagecreatefromgif( $file_path );
				break;
			case 'image/webp':
				if ( function_exists( 'imagecreatefromwebp' ) ) {
					$image = imagecreatefromwebp( $file_path );
				}
				break;
		}

		if ( ! $image ) {
			return false;
		}

		// Créer la nouvelle image redimensionnée
		$thumb = imagecreatetruecolor( $new_width, $new_height );
		if ( ! $thumb ) {
			imagedestroy( $image );
			return false;
		}

		// Préserver la transparence pour PNG et GIF
		if ( in_array( $mime_type, array( 'image/png', 'image/gif' ), true ) ) {
			imagealphablending( $thumb, false );
			imagesavealpha( $thumb, true );
			$transparent = imagecolorallocatealpha( $thumb, 255, 255, 255, 127 );
			imagefill( $thumb, 0, 0, $transparent );
		}

		// Redimensionner l'image avec une qualité élevée
		imagecopyresampled(
			$thumb,
			$image,
			0, 0, 0, 0,
			$new_width,
			$new_height,
			$original_width,
			$original_height
		);

		// Sauvegarder la vignette
		$saved = false;
		switch ( $mime_type ) {
			case 'image/jpeg':
				$saved = imagejpeg( $thumb, $thumb_path, 90 ); // Qualité 90%
				break;
			case 'image/png':
				$saved = imagepng( $thumb, $thumb_path, 9 ); // Compression 9
				break;
			case 'image/gif':
				$saved = imagegif( $thumb, $thumb_path );
				break;
			case 'image/webp':
				if ( function_exists( 'imagewebp' ) ) {
					$saved = imagewebp( $thumb, $thumb_path, 90 );
				}
				break;
		}

		// Nettoyer la mémoire
		imagedestroy( $image );
		imagedestroy( $thumb );

		if ( ! $saved ) {
			return false;
		}

		return $thumb_url;
	}

	/**
	 * Suppression éventuelle des images.
	 */
	/**
	 * Parse une valeur de taille PHP (ex: "128M", "2G") en bytes.
	 *
	 * @param string $size Valeur de taille.
	 * @return int Taille en bytes.
	 */
	private function parse_size( $size ) {
		$size = trim( $size );
		$last = strtolower( $size[ strlen( $size ) - 1 ] );
		$size = (int) $size;
		
		switch ( $last ) {
			case 'g':
				$size *= 1024;
				// Pas de break, continuer avec M
			case 'm':
				$size *= 1024;
				// Pas de break, continuer avec K
			case 'k':
				$size *= 1024;
		}
		
		return $size;
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
		$count = min( $count, 30 ); // Maximum 30 images pour la recherche
		$query = isset( $_POST['query'] ) ? sanitize_text_field( wp_unslash( $_POST['query'] ) ) : '';
		$page = isset( $_POST['page'] ) ? absint( $_POST['page'] ) : 1;

		$access_key = 'p9RniMVfR7MiCI-YC8pDpM9zob_a4fOyMQzmcDAIPVY';
		
		// Si un mot-clé est fourni, utiliser l'endpoint de recherche, sinon utiliser random
		if ( ! empty( $query ) ) {
			$query_encoded = urlencode( $query );
			$url = sprintf( 'https://api.unsplash.com/search/photos?query=%s&per_page=%d&page=%d&client_id=%s', $query_encoded, $count, $page, $access_key );
		} else {
			$url = sprintf( 'https://api.unsplash.com/photos/random?count=%d&client_id=%s', $count, $access_key );
		}

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

		// L'API de recherche retourne un objet avec une propriété 'results', l'API random retourne directement un tableau
		$photos = array();
		if ( ! empty( $query ) ) {
			// Format de recherche : { results: [...] }
			if ( isset( $data['results'] ) && is_array( $data['results'] ) ) {
				$photos = $data['results'];
			}
		} else {
			// Format random : tableau direct
			if ( is_array( $data ) ) {
				$photos = $data;
			}
		}

		if ( empty( $photos ) ) {
			wp_send_json_error( 
				array( 
					'message' => ! empty( $query ) 
						? __( 'Aucune image trouvée pour ce mot-clé.', 'wc-photo-clock-13' )
						: __( 'Aucune image récupérée depuis Unsplash.', 'wc-photo-clock-13' ),
					'debug' => $body
				) 
			);
		}

		$images = array();
		foreach ( $photos as $index => $photo ) {
			// Pour la première image (centrale), utiliser 'regular' ou 'full' pour une résolution plus élevée
			// Pour les autres images (périphériques), utiliser 'small' pour des images moins lourdes
			if ( $index === 0 ) {
				// Photo centrale : utiliser 'regular' (1080px) ou 'full' si disponible
				if ( isset( $photo['urls']['regular'] ) ) {
					$images[] = array(
						'url' => $photo['urls']['regular'],
						'thumb' => isset( $photo['urls']['small'] ) ? $photo['urls']['small'] : $photo['urls']['regular'],
					);
				} elseif ( isset( $photo['urls']['full'] ) ) {
					$images[] = array(
						'url' => $photo['urls']['full'],
						'thumb' => isset( $photo['urls']['small'] ) ? $photo['urls']['small'] : $photo['urls']['full'],
					);
				} elseif ( isset( $photo['urls']['small'] ) ) {
					// Fallback sur small si regular/full ne sont pas disponibles
					$images[] = array(
						'url' => $photo['urls']['small'],
						'thumb' => isset( $photo['urls']['thumb'] ) ? $photo['urls']['thumb'] : $photo['urls']['small'],
					);
				}
			} else {
				// Photos périphériques : utiliser 'regular' (1080px) pour de meilleures performances lors du déplacement
				if ( isset( $photo['urls']['regular'] ) ) {
					$images[] = array(
						'url' => $photo['urls']['regular'],
						'thumb' => isset( $photo['urls']['small'] ) ? $photo['urls']['small'] : $photo['urls']['regular'],
					);
				} elseif ( isset( $photo['urls']['full'] ) ) {
					// Fallback sur full si regular n'est pas disponible
					$images[] = array(
						'url' => $photo['urls']['full'],
						'thumb' => isset( $photo['urls']['small'] ) ? $photo['urls']['small'] : $photo['urls']['full'],
					);
				} elseif ( isset( $photo['urls']['small'] ) ) {
					// Fallback sur small si regular/full ne sont pas disponibles
					$images[] = array(
						'url' => $photo['urls']['small'],
						'thumb' => isset( $photo['urls']['thumb'] ) ? $photo['urls']['thumb'] : $photo['urls']['small'],
					);
				}
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

		// Obtenir les fragments WooCommerce pour mettre à jour le panier (optionnel pour performance)
		$fragments = array();
		$cart_hash = '';
		
		// Générer les fragments seulement si nécessaire (peut être désactivé pour améliorer les performances)
		$generate_fragments = apply_filters( 'wc_pc13_generate_cart_fragments', true );
		if ( $generate_fragments ) {
			ob_start();
			woocommerce_mini_cart();
			$mini_cart = ob_get_clean();

			$fragments = apply_filters(
				'woocommerce_add_to_cart_fragments',
				array(
					'div.widget_shopping_cart_content' => '<div class="widget_shopping_cart_content">' . $mini_cart . '</div>',
				)
			);

			// Ajouter le hash du panier
			$cart_hash = WC()->cart->get_cart_hash();
		}

		// Récupérer le prix depuis la configuration
		$price = 0;
		if ( ! empty( $cart_item_data['wc_pc13']['diameter_price'] ) ) {
			$price = floatval( $cart_item_data['wc_pc13']['diameter_price'] );
		}

		wp_send_json_success(
			array(
				'message'      => __( 'Produit ajouté au panier avec succès.', 'wc-photo-clock-13' ),
				'cart_count'   => $cart_count,
				'preview_url'  => $preview_image_url,
				'product_name' => $product->get_name(),
				'price'        => $price,
				'fragments'    => $fragments,
				'cart_hash'    => $cart_hash,
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


