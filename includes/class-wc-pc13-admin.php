<?php
/**
 * Page d’administration et réglages globaux.
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_PC13_Admin {

	/**
	 * Instance.
	 *
	 * @var WC_PC13_Admin|null
	 */
	protected static $instance = null;

	/**
	 * Option key.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'wc_pc13_settings';

	/**
	 * Singleton.
	 *
	 * @return WC_PC13_Admin
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
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( WC_PC13_PLUGIN_FILE ), array( $this, 'register_action_link' ) );
	}

	/**
	 * Ajout du lien "Réglages" dans la liste des plugins.
	 *
	 * @param array $links Liens existants.
	 *
	 * @return array
	 */
	public function register_action_link( $links ) {
		$url     = admin_url( 'admin.php?page=wc-pc13-admin' );
		$links[] = sprintf(
			'<a href="%1$s">%2$s</a>',
			esc_url( $url ),
			esc_html__( 'Configuration', 'wc-photo-clock-13' )
		);

		return $links;
	}

	/**
	 * Enregistre le menu.
	 */
	public function register_menu() {
		add_submenu_page(
			'woocommerce',
			__( 'Horloge 13 Photos', 'wc-photo-clock-13' ),
			__( 'Horloge 13 Photos', 'wc-photo-clock-13' ),
			'manage_woocommerce',
			'wc-pc13-admin',
			array( $this, 'render_admin_page' )
		);
	}

	/**
	 * Déclare les réglages.
	 */
	public function register_settings() {
		register_setting(
			'wc_pc13_settings_group',
			self::OPTION_KEY,
			array( $this, 'sanitize_settings' )
		);

		add_settings_section(
			'wc_pc13_main_section',
			__( 'Préférences générales', 'wc-photo-clock-13' ),
			'__return_false',
			'wc_pc13_settings'
		);

		add_settings_field(
			'default_hands',
			__( 'Style d’aiguilles par défaut', 'wc-photo-clock-13' ),
			array( $this, 'render_field_hands' ),
			'wc_pc13_settings',
			'wc_pc13_main_section'
		);

		add_settings_field(
			'default_color',
			__( 'Couleur d’accent par défaut', 'wc-photo-clock-13' ),
			array( $this, 'render_field_color' ),
			'wc_pc13_settings',
			'wc_pc13_main_section'
		);

		add_settings_field(
			'max_upload_size',
			__( 'Taille maximale des images (Mo)', 'wc-photo-clock-13' ),
			array( $this, 'render_field_max_upload' ),
			'wc_pc13_settings',
			'wc_pc13_main_section'
		);

		add_settings_field(
			'thumb_max_size',
			__( 'Taille max des vignettes (px)', 'wc-photo-clock-13' ),
			array( $this, 'render_field_thumb_max' ),
			'wc_pc13_settings',
			'wc_pc13_main_section'
		);

		add_settings_field(
			'default_diameter',
			__( 'Diamètre par défaut (cm)', 'wc-photo-clock-13' ),
			array( $this, 'render_field_diameter' ),
			'wc_pc13_settings',
			'wc_pc13_main_section'
		);
	}

	/**
	 * Rendu de la page des emails collectés.
	 */
	public function render_share_emails_page() {
		$entries = get_option( 'wc_pc13_share_emails', array() );
		if ( ! is_array( $entries ) ) {
			$entries = array();
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Emails collectés via partage', 'wc-photo-clock-13' ); ?></h1>
			<?php if ( empty( $entries ) ) : ?>
				<p><?php esc_html_e( 'Aucun email collecté pour le moment.', 'wc-photo-clock-13' ); ?></p>
			<?php else : ?>
				<table class="widefat striped">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Email', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Share ID', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Produit', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Date', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Lien', 'wc-photo-clock-13' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $entries as $entry ) : ?>
							<tr>
								<td><?php echo esc_html( isset( $entry['email'] ) ? $entry['email'] : '' ); ?></td>
								<td><code><?php echo esc_html( isset( $entry['share_id'] ) ? $entry['share_id'] : '' ); ?></code></td>
								<td>
									<?php
									$product_id = isset( $entry['product_id'] ) ? absint( $entry['product_id'] ) : 0;
									if ( $product_id ) {
										$title = get_the_title( $product_id );
										echo '<a href="' . esc_url( get_edit_post_link( $product_id ) ) . '">' . esc_html( $title ? $title : sprintf( __( 'Produit #%d', 'wc-photo-clock-13' ), $product_id ) ) . '</a>';
									} else {
										esc_html_e( 'Non renseigné', 'wc-photo-clock-13' );
									}
									?>
								</td>
								<td><?php echo esc_html( isset( $entry['created_at'] ) ? $entry['created_at'] : '—' ); ?></td>
								<td>
									<?php if ( ! empty( $entry['share_url'] ) ) : ?>
										<a href="<?php echo esc_url( $entry['share_url'] ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Ouvrir', 'wc-photo-clock-13' ); ?></a>
									<?php else : ?>
										—
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Nettoie les réglages.
	 *
	 * @param array $input Données saisies.
	 *
	 * @return array
	 */
	public function sanitize_settings( $input ) {
		$defaults = $this->get_settings();

		return array(
			'default_hands'   => isset( $input['default_hands'] ) ? sanitize_text_field( $input['default_hands'] ) : $defaults['default_hands'],
			'default_color'   => isset( $input['default_color'] ) ? sanitize_hex_color( $input['default_color'] ) : $defaults['default_color'],
			'max_upload_size' => isset( $input['max_upload_size'] ) ? max( 1, absint( $input['max_upload_size'] ) ) : $defaults['max_upload_size'],
			'thumb_max_size'  => isset( $input['thumb_max_size'] ) ? max( 200, absint( $input['thumb_max_size'] ) ) : $defaults['thumb_max_size'],
			'default_diameter' => isset( $input['default_diameter'] ) ? $this->sanitize_diameter( $input['default_diameter'], $defaults['default_diameter'] ) : $defaults['default_diameter'],
		);
	}

	/**
	 * Rendu du champ style aiguilles.
	 */
	public function render_field_hands() {
		$options = $this->get_settings();
		$hands   = array(
			'classic' => __( 'Classique', 'wc-photo-clock-13' ),
			'modern'  => __( 'Moderne', 'wc-photo-clock-13' ),
			'minimal' => __( 'Minimaliste', 'wc-photo-clock-13' ),
		);
		?>
		<select name="<?php echo esc_attr( self::OPTION_KEY ); ?>[default_hands]">
			<?php foreach ( $hands as $key => $label ) : ?>
				<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $options['default_hands'], $key ); ?>>
					<?php echo esc_html( $label ); ?>
				</option>
			<?php endforeach; ?>
		</select>
		<?php
	}

	/**
	 * Rendu du champ couleur.
	 */
	public function render_field_color() {
		$options = $this->get_settings();
		?>
		<input type="text" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[default_color]" value="<?php echo esc_attr( $options['default_color'] ); ?>" class="wc-pc13-color-field" data-default-color="#111111">
		<p class="description"><?php esc_html_e( 'Utilisée si aucune couleur spécifique n’est définie sur un produit.', 'wc-photo-clock-13' ); ?></p>
		<?php
	}

	/**
	 * Rendu du champ diamètre.
	 */
	public function render_field_diameter() {
		$options   = $this->get_settings();
		$diameters = $this->get_available_diameters();
		?>
		<select name="<?php echo esc_attr( self::OPTION_KEY ); ?>[default_diameter]">
			<?php foreach ( $diameters as $value ) : ?>
				<option value="<?php echo esc_attr( $value ); ?>" <?php selected( (int) $options['default_diameter'], $value ); ?>>
					<?php echo esc_html( sprintf( _x( '%d cm', 'diameter value', 'wc-photo-clock-13' ), $value ) ); ?>
				</option>
			<?php endforeach; ?>
		</select>
		<p class="description"><?php esc_html_e( 'Diamètre choisi par défaut sur le configurateur client.', 'wc-photo-clock-13' ); ?></p>
		<?php
	}

	/**
	 * Rendu du champ taille max upload.
	 */
	public function render_field_max_upload() {
		$options = $this->get_settings();
		?>
		<input type="number" min="1" max="50" step="1" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[max_upload_size]" value="<?php echo esc_attr( $options['max_upload_size'] ); ?>">
		<p class="description"><?php esc_html_e( 'Contrôle la taille maximale des images téléversées par les clients.', 'wc-photo-clock-13' ); ?></p>
		<?php
	}

	/**
	 * Rendu du champ taille max vignette.
	 */
	public function render_field_thumb_max() {
		$options = $this->get_settings();
		?>
		<input type="number" min="200" max="4000" step="50" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[thumb_max_size]" value="<?php echo esc_attr( $options['thumb_max_size'] ); ?>">
		<p class="description"><?php esc_html_e( 'Dimension maximale (px) du plus grand côté pour la vignette générée côté serveur.', 'wc-photo-clock-13' ); ?></p>
		<?php
	}

	/**
	 * Rendu de la page de réglages.
	 */
	public function render_settings_page() {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Horloge Photo 13 - Configuration', 'wc-photo-clock-13' ); ?></h1>
			<div class="wc-pc13-help">
				<p><?php esc_html_e( 'Activez l’option sur les produits WooCommerce concernés pour afficher le configurateur 13 photos côté boutique.', 'wc-photo-clock-13' ); ?></p>
				<p><?php esc_html_e( 'Par défaut, les réglages ci-dessous définissent le style d’aiguilles, la couleur d’accent et la taille maximale des images téléversées. Chaque produit peut ensuite surcharger ces valeurs dans son onglet « Horloge 13 Photos ».', 'wc-photo-clock-13' ); ?></p>
				<p><?php esc_html_e( 'Sur la fiche produit, vos clients peuvent importer jusqu’à 13 photos, les déplacer, zoomer, choisir leurs aiguilles et visualiser instantanément l’aperçu avant de passer commande.', 'wc-photo-clock-13' ); ?></p>
			</div>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'wc_pc13_settings_group' );
				do_settings_sections( 'wc_pc13_settings' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Retourne les réglages.
	 *
	 * @return array
	 */
	public function get_settings() {
		$defaults = array(
			'default_hands'   => 'classic',
			'default_color'   => '#111111',
			'max_upload_size' => 10,
			'thumb_max_size'  => 2000,
			'default_diameter' => 30,
		);

		$options = get_option( self::OPTION_KEY, array() );

		if ( empty( $options ) ) {
			return $defaults;
		}

		return wp_parse_args( $options, $defaults );
	}

	/**
	 * Rendu de la page des projets (liens de partage enregistrés).
	 */
	public function render_projects_page() {
		global $wpdb;

		$prefix   = '_transient_wc_pc13_share_';
		$like     = $wpdb->esc_like( $prefix ) . '%';
		$rows     = $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s", $like ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$projects = array();

		if ( $rows ) {
			foreach ( $rows as $option_name ) {
				$key       = str_replace( '_transient_', '', $option_name );
				$share_id  = str_replace( 'wc_pc13_share_', '', $key );
				$payload   = get_transient( $key );
				if ( false === $payload || empty( $payload['config'] ) ) {
					continue;
				}
				$product_id = isset( $payload['product_id'] ) ? absint( $payload['product_id'] ) : 0;
				$created_at = isset( $payload['created_at'] ) ? $payload['created_at'] : '';
				$projects[] = array(
					'share_id'   => $share_id,
					'product_id' => $product_id,
					'created_at' => $created_at,
					'url'        => add_query_arg(
						array( 'share' => $share_id ),
						get_permalink( $product_id )
					),
				);
			}
		}

		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Projets horloge (liens sauvegardés)', 'wc-photo-clock-13' ); ?></h1>
			<?php if ( empty( $projects ) ) : ?>
				<p><?php esc_html_e( 'Aucun projet trouvé pour le moment.', 'wc-photo-clock-13' ); ?></p>
			<?php else : ?>
				<table class="widefat striped">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Share ID', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Produit', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Date de création', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Lien', 'wc-photo-clock-13' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $projects as $project ) : ?>
							<tr>
								<td><code><?php echo esc_html( $project['share_id'] ); ?></code></td>
								<td>
									<?php
									if ( $project['product_id'] ) {
										$title = get_the_title( $project['product_id'] );
										echo '<a href="' . esc_url( get_edit_post_link( $project['product_id'] ) ) . '">' . esc_html( $title ? $title : sprintf( __( 'Produit #%d', 'wc-photo-clock-13' ), $project['product_id'] ) ) . '</a>';
									} else {
										esc_html_e( 'Non renseigné', 'wc-photo-clock-13' );
									}
									?>
								</td>
								<td><?php echo esc_html( $project['created_at'] ? $project['created_at'] : '—' ); ?></td>
								<td><a href="<?php echo esc_url( $project['url'] ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Ouvrir', 'wc-photo-clock-13' ); ?></a></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Retourne les diamètres disponibles.
	 *
	 * @return array
	 */
	public function get_available_diameters() {
		return array( 20, 30, 40, 50, 60, 80, 100 );
	}

	/**
	 * Valide un diamètre.
	 *
	 * @param mixed $value    Valeur reçue.
	 * @param int   $fallback Valeur par défaut.
	 *
	 * @return int
	 */
	private function sanitize_diameter( $value, $fallback ) {
		$allowed = $this->get_available_diameters();
		$value   = absint( $value );

		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}

	/**
	 * Rendu de l'onglet Créations.
	 */
	private function render_creations_tab() {
		global $wpdb;

		// Récupérer les créations depuis les commandes
		$orders_query = new WP_Query( array(
			'post_type' => 'shop_order',
			'post_status' => array( 'wc-completed', 'wc-processing', 'wc-on-hold', 'wc-pending' ),
			'posts_per_page' => -1,
		) );

		$order_creations = array();
		if ( $orders_query->have_posts() ) {
			foreach ( $orders_query->posts as $order_post ) {
				$order = wc_get_order( $order_post->ID );
				if ( ! $order ) {
					continue;
				}

				foreach ( $order->get_items() as $item_id => $item ) {
					$config_json = $item->get_meta( 'wc_pc13_config' );
					if ( ! $config_json ) {
						continue;
					}

					$config = json_decode( $config_json, true );
					if ( ! $config ) {
						continue;
					}

					$preview_json = $item->get_meta( 'wc_pc13_preview' );
					$preview = $preview_json ? json_decode( $preview_json, true ) : null;

					$order_creations[] = array(
						'type' => 'order',
						'order_id' => $order->get_id(),
						'order_number' => $order->get_order_number(),
						'order_date' => $order->get_date_created()->date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) ),
						'customer' => $order->get_billing_email(),
						'product_id' => $item->get_product_id(),
						'product_name' => $item->get_name(),
						'config' => $config,
						'preview' => $preview,
					);
				}
			}
		}

		// Récupérer les créations depuis les transients (partages)
		$prefix = '_transient_wc_pc13_share_';
		$like = $wpdb->esc_like( $prefix ) . '%';
		$rows = $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s", $like ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		
		$share_creations = array();
		if ( $rows ) {
			foreach ( $rows as $option_name ) {
				$key = str_replace( '_transient_', '', $option_name );
				$share_id = str_replace( 'wc_pc13_share_', '', $key );
				$payload = get_transient( $key );
				if ( false === $payload || empty( $payload['config'] ) ) {
					continue;
				}
				$product_id = isset( $payload['product_id'] ) ? absint( $payload['product_id'] ) : 0;
				$created_at = isset( $payload['created_at'] ) ? $payload['created_at'] : '';
				$share_creations[] = array(
					'type' => 'share',
					'share_id' => $share_id,
					'product_id' => $product_id,
					'created_at' => $created_at,
					'config' => $payload['config'],
					'url' => add_query_arg(
						array( 'share' => $share_id ),
						get_permalink( $product_id )
					),
				);
			}
		}

		// Trier toutes les créations par date (plus récentes en premier)
		$all_creations = array_merge( $order_creations, $share_creations );
		usort( $all_creations, function( $a, $b ) {
			$date_a = isset( $a['order_date'] ) ? $a['order_date'] : ( isset( $a['created_at'] ) ? $a['created_at'] : '' );
			$date_b = isset( $b['order_date'] ) ? $b['order_date'] : ( isset( $b['created_at'] ) ? $b['created_at'] : '' );
			return strcmp( $date_b, $date_a );
		});

		?>
		<div class="wc-pc13-tab-content">
			<h2><?php esc_html_e( 'Toutes les créations d\'horloge', 'wc-photo-clock-13' ); ?></h2>
			<p class="description"><?php esc_html_e( 'Liste de toutes les horloges créées, qu\'elles aient été commandées ou simplement partagées.', 'wc-photo-clock-13' ); ?></p>
			
			<?php if ( empty( $all_creations ) ) : ?>
				<p><?php esc_html_e( 'Aucune création trouvée pour le moment.', 'wc-photo-clock-13' ); ?></p>
			<?php else : ?>
				<table class="widefat striped">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Type', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Produit', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Client / Email', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Date', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Actions', 'wc-photo-clock-13' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $all_creations as $creation ) : ?>
							<tr>
								<td>
									<?php if ( $creation['type'] === 'order' ) : ?>
										<span class="dashicons dashicons-cart" title="<?php esc_attr_e( 'Commande', 'wc-photo-clock-13' ); ?>"></span>
										<?php esc_html_e( 'Commande', 'wc-photo-clock-13' ); ?>
									<?php else : ?>
										<span class="dashicons dashicons-share" title="<?php esc_attr_e( 'Partage', 'wc-photo-clock-13' ); ?>"></span>
										<?php esc_html_e( 'Partage', 'wc-photo-clock-13' ); ?>
									<?php endif; ?>
								</td>
								<td>
									<?php
									$product_id = isset( $creation['product_id'] ) ? absint( $creation['product_id'] ) : 0;
									if ( $product_id ) {
										$title = isset( $creation['product_name'] ) ? $creation['product_name'] : get_the_title( $product_id );
										echo '<a href="' . esc_url( get_edit_post_link( $product_id ) ) . '">' . esc_html( $title ? $title : sprintf( __( 'Produit #%d', 'wc-photo-clock-13' ), $product_id ) ) . '</a>';
									} else {
										esc_html_e( 'Non renseigné', 'wc-photo-clock-13' );
									}
									?>
								</td>
								<td>
									<?php if ( $creation['type'] === 'order' ) : ?>
										<?php
										$order_id = isset( $creation['order_id'] ) ? absint( $creation['order_id'] ) : 0;
										$customer = isset( $creation['customer'] ) ? $creation['customer'] : '';
										if ( $order_id ) {
											echo '<a href="' . esc_url( admin_url( 'post.php?post=' . $order_id . '&action=edit' ) ) . '">';
											echo esc_html( sprintf( __( 'Commande #%s', 'wc-photo-clock-13' ), $creation['order_number'] ) );
											echo '</a>';
											if ( $customer ) {
												echo '<br><small>' . esc_html( $customer ) . '</small>';
											}
										}
										?>
									<?php else : ?>
										<?php esc_html_e( 'Non renseigné', 'wc-photo-clock-13' ); ?>
									<?php endif; ?>
								</td>
								<td>
									<?php
									$date = isset( $creation['order_date'] ) ? $creation['order_date'] : ( isset( $creation['created_at'] ) ? $creation['created_at'] : '—' );
									echo esc_html( $date );
									?>
								</td>
								<td>
									<?php if ( $creation['type'] === 'order' && isset( $creation['order_id'] ) ) : ?>
										<a href="<?php echo esc_url( admin_url( 'post.php?post=' . $creation['order_id'] . '&action=edit' ) ); ?>" class="button button-small">
											<?php esc_html_e( 'Voir la commande', 'wc-photo-clock-13' ); ?>
										</a>
									<?php elseif ( isset( $creation['url'] ) ) : ?>
										<a href="<?php echo esc_url( $creation['url'] ); ?>" target="_blank" rel="noopener noreferrer" class="button button-small">
											<?php esc_html_e( 'Ouvrir', 'wc-photo-clock-13' ); ?>
										</a>
									<?php endif; ?>
									<?php if ( isset( $creation['preview'] ) && ! empty( $creation['preview'] ) ) : ?>
										<?php
										$preview_url = '';
										if ( ! empty( $creation['preview']['url'] ) ) {
											$preview_url = esc_url( $creation['preview']['url'] );
										} elseif ( ! empty( $creation['preview']['id'] ) ) {
											$preview_url = esc_url( wp_get_attachment_url( absint( $creation['preview']['id'] ) ) );
										}
										if ( $preview_url ) :
											?>
											<a href="<?php echo $preview_url; ?>" target="_blank" rel="noopener noreferrer" class="button button-small">
												<?php esc_html_e( 'Aperçu', 'wc-photo-clock-13' ); ?>
											</a>
										<?php endif; ?>
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Rendu de l'onglet Emails.
	 */
	private function render_emails_tab() {
		// Emails de partage
		$share_emails = get_option( 'wc_pc13_share_emails', array() );
		if ( ! is_array( $share_emails ) ) {
			$share_emails = array();
		}

		?>
		<div class="wc-pc13-tab-content">
			<h2><?php esc_html_e( 'Emails collectés', 'wc-photo-clock-13' ); ?></h2>
			<p class="description"><?php esc_html_e( 'Liste de tous les emails collectés via les partages de configuration.', 'wc-photo-clock-13' ); ?></p>
			
			<?php if ( empty( $share_emails ) ) : ?>
				<p><?php esc_html_e( 'Aucun email collecté pour le moment.', 'wc-photo-clock-13' ); ?></p>
			<?php else : ?>
				<table class="widefat striped">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Email', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Share ID', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Produit', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Date', 'wc-photo-clock-13' ); ?></th>
							<th><?php esc_html_e( 'Lien', 'wc-photo-clock-13' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $share_emails as $entry ) : ?>
							<tr>
								<td><?php echo esc_html( isset( $entry['email'] ) ? $entry['email'] : '' ); ?></td>
								<td><code><?php echo esc_html( isset( $entry['share_id'] ) ? $entry['share_id'] : '' ); ?></code></td>
								<td>
									<?php
									$product_id = isset( $entry['product_id'] ) ? absint( $entry['product_id'] ) : 0;
									if ( $product_id ) {
										$title = get_the_title( $product_id );
										echo '<a href="' . esc_url( get_edit_post_link( $product_id ) ) . '">' . esc_html( $title ? $title : sprintf( __( 'Produit #%d', 'wc-photo-clock-13' ), $product_id ) ) . '</a>';
									} else {
										esc_html_e( 'Non renseigné', 'wc-photo-clock-13' );
									}
									?>
								</td>
								<td><?php echo esc_html( isset( $entry['created_at'] ) ? $entry['created_at'] : '—' ); ?></td>
								<td>
									<?php if ( ! empty( $entry['share_url'] ) ) : ?>
										<a href="<?php echo esc_url( $entry['share_url'] ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Ouvrir', 'wc-photo-clock-13' ); ?></a>
									<?php else : ?>
										—
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Rendu de l'onglet Statistiques.
	 */
	private function render_stats_tab() {
		global $wpdb;

		// Statistiques des commandes
		$orders_with_config = get_posts( array(
			'post_type' => 'shop_order',
			'post_status' => 'any',
			'posts_per_page' => -1,
			'fields' => 'ids',
		) );

		$total_orders = 0;
		foreach ( $orders_with_config as $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				continue;
			}
			foreach ( $order->get_items() as $item ) {
				if ( $item->get_meta( 'wc_pc13_config' ) ) {
					$total_orders++;
					break;
				}
			}
		}

		// Statistiques des partages
		$prefix = '_transient_wc_pc13_share_';
		$like = $wpdb->esc_like( $prefix ) . '%';
		$share_count = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s", $like ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Statistiques des emails
		$share_emails = get_option( 'wc_pc13_share_emails', array() );
		$total_emails = is_array( $share_emails ) ? count( $share_emails ) : 0;

		// Produits avec configurateur activé
		$products_with_config = get_posts( array(
			'post_type' => 'product',
			'posts_per_page' => -1,
			'meta_query' => array(
				array(
					'key' => '_wc_pc13_enabled',
					'value' => 'yes',
					'compare' => '=',
				),
			),
			'fields' => 'ids',
		) );
		$total_products = count( $products_with_config );

		?>
		<div class="wc-pc13-tab-content">
			<h2><?php esc_html_e( 'Statistiques', 'wc-photo-clock-13' ); ?></h2>
			
			<div class="wc-pc13-stats-grid">
				<div class="wc-pc13-stat-box">
					<h3><?php esc_html_e( 'Produits activés', 'wc-photo-clock-13' ); ?></h3>
					<p class="wc-pc13-stat-number"><?php echo esc_html( $total_products ); ?></p>
					<p class="description"><?php esc_html_e( 'Nombre de produits avec le configurateur activé', 'wc-photo-clock-13' ); ?></p>
				</div>

				<div class="wc-pc13-stat-box">
					<h3><?php esc_html_e( 'Commandes avec horloge', 'wc-photo-clock-13' ); ?></h3>
					<p class="wc-pc13-stat-number"><?php echo esc_html( $total_orders ); ?></p>
					<p class="description"><?php esc_html_e( 'Nombre de commandes contenant une horloge personnalisée', 'wc-photo-clock-13' ); ?></p>
				</div>

				<div class="wc-pc13-stat-box">
					<h3><?php esc_html_e( 'Partages sauvegardés', 'wc-photo-clock-13' ); ?></h3>
					<p class="wc-pc13-stat-number"><?php echo esc_html( $share_count ); ?></p>
					<p class="description"><?php esc_html_e( 'Nombre de configurations partagées (transients actifs)', 'wc-photo-clock-13' ); ?></p>
				</div>

				<div class="wc-pc13-stat-box">
					<h3><?php esc_html_e( 'Emails collectés', 'wc-photo-clock-13' ); ?></h3>
					<p class="wc-pc13-stat-number"><?php echo esc_html( $total_emails ); ?></p>
					<p class="description"><?php esc_html_e( 'Nombre d\'emails collectés via les partages', 'wc-photo-clock-13' ); ?></p>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Affiche les styles CSS pour la page d'administration.
	 */
	private function render_admin_styles() {
		?>
		<style>
			.wc-pc13-admin-content {
				margin-top: 20px;
			}
			.wc-pc13-tab-content {
				background: #fff;
				padding: 20px;
				border: 1px solid #ccd0d4;
				box-shadow: 0 1px 1px rgba(0,0,0,.04);
			}
			.wc-pc13-stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
				gap: 20px;
				margin-top: 20px;
			}
			.wc-pc13-stat-box {
				background: #f9f9f9;
				border: 1px solid #ddd;
				border-radius: 4px;
				padding: 20px;
				text-align: center;
			}
			.wc-pc13-stat-box h3 {
				margin: 0 0 10px 0;
				font-size: 14px;
				color: #666;
			}
			.wc-pc13-stat-number {
				font-size: 36px;
				font-weight: bold;
				color: #2271b1;
				margin: 10px 0;
			}
			.wc-pc13-stat-box .description {
				margin: 10px 0 0 0;
				font-size: 12px;
				color: #666;
			}
		</style>
		<?php
	}
}


