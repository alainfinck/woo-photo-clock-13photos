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
		$url     = admin_url( 'admin.php?page=wc-pc13-settings' );
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
			'wc-pc13-settings',
			array( $this, 'render_settings_page' )
		);

		add_submenu_page(
			'woocommerce',
			__( 'Projets Horloge 13', 'wc-photo-clock-13' ),
			__( 'Projets Horloge 13', 'wc-photo-clock-13' ),
			'manage_woocommerce',
			'wc-pc13-projects',
			array( $this, 'render_projects_page' )
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
}


