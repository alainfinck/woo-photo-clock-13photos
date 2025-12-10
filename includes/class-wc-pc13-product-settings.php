<?php
/**
 * Réglages produit WooCommerce.
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_PC13_Product_Settings {

	/**
	 * Instance.
	 *
	 * @var WC_PC13_Product_Settings|null
	 */
	protected static $instance = null;

	/**
	 * Singleton.
	 *
	 * @return WC_PC13_Product_Settings
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
		add_filter( 'woocommerce_product_data_tabs', array( $this, 'add_product_tab' ) );
		add_action( 'woocommerce_product_data_panels', array( $this, 'render_product_panel' ) );
		add_action( 'woocommerce_admin_process_product_object', array( $this, 'save_product_data' ) );
	}

	/**
	 * Ajoute un onglet personnalisé.
	 *
	 * @param array $tabs Onglets existants.
	 *
	 * @return array
	 */
	public function add_product_tab( $tabs ) {
		$tabs['wc_pc13'] = array(
			'label'    => __( 'Horloge 13 Photos', 'wc-photo-clock-13' ),
			'target'   => 'wc_pc13_product_data',
			'class'    => array(),
			'priority' => 80,
		);

		return $tabs;
	}

	/**
	 * Rendu du panneau.
	 */
	public function render_product_panel() {
		global $post;
		$enabled        = get_post_meta( $post->ID, '_wc_pc13_enabled', true );
		$hands          = get_post_meta( $post->ID, '_wc_pc13_default_hands', true );
		$accent_color   = get_post_meta( $post->ID, '_wc_pc13_default_color', true );
		$diameter       = get_post_meta( $post->ID, '_wc_pc13_default_diameter', true );
		$settings       = class_exists( 'WC_PC13_Admin' ) ? WC_PC13_Admin::instance()->get_settings() : array(
			'default_hands'    => 'classic',
			'default_color'    => '#111111',
			'default_diameter' => 30,
		);
		$default_hands  = $hands ? $hands : $settings['default_hands'];
		$default_color  = $accent_color ? $accent_color : $settings['default_color'];
		$default_diameter = $diameter ? absint( $diameter ) : ( isset( $settings['default_diameter'] ) ? $settings['default_diameter'] : 30 );
		$diameter_options = class_exists( 'WC_PC13_Admin' ) ? WC_PC13_Admin::instance()->get_available_diameters() : array( 20, 30, 40, 50, 60, 80, 100 );
		$hands_options  = array(
			'classic' => __( 'Classique', 'wc-photo-clock-13' ),
			'modern'  => __( 'Moderne', 'wc-photo-clock-13' ),
			'minimal' => __( 'Minimaliste', 'wc-photo-clock-13' ),
		);
		?>
		<div id="wc_pc13_product_data" class="panel woocommerce_options_panel hidden">
			<div class="options_group">
				<?php
				woocommerce_wp_checkbox(
					array(
						'id'          => '_wc_pc13_enabled',
						'label'       => __( 'Personnalisation Horloge 13 Photos', 'wc-photo-clock-13' ),
						'description' => __( 'Affiche le configurateur de l’horloge personnalisée sur la fiche produit.', 'wc-photo-clock-13' ),
						'value'       => 'yes' === $enabled ? 'yes' : 'no',
					)
				);
				woocommerce_wp_select(
					array(
						'id'          => '_wc_pc13_default_hands',
						'label'       => __( 'Style d’aiguilles par défaut', 'wc-photo-clock-13' ),
						'description' => __( 'Option pré-sélectionnée pour les clients.', 'wc-photo-clock-13' ),
						'value'       => $default_hands,
						'options'     => $hands_options,
					)
				);
				woocommerce_wp_text_input(
					array(
						'id'                => '_wc_pc13_default_color',
						'label'             => __( 'Couleur d’accent par défaut', 'wc-photo-clock-13' ),
						'description'       => __( 'S’applique aux aiguilles et marquages si le client ne choisit pas autre chose.', 'wc-photo-clock-13' ),
						'value'             => $default_color,
						'class'             => 'color-picker',
						'data_type'         => 'text',
						'type'              => 'text',
					)
				);
				woocommerce_wp_select(
					array(
						'id'          => '_wc_pc13_default_diameter',
						'label'       => __( 'Diamètre par défaut (cm)', 'wc-photo-clock-13' ),
						'description' => __( 'Valeur pré-sélectionnée pour le client.', 'wc-photo-clock-13' ),
						'value'       => $default_diameter,
						'options'     => array_combine(
							array_map( 'strval', $diameter_options ),
							array_map(
								function ( $value ) {
									return sprintf( _x( '%d cm', 'diameter value', 'wc-photo-clock-13' ), $value );
								},
								$diameter_options
							)
						),
					)
				);
				?>
			</div>
		</div>
		<?php
	}

	/**
	 * Sauvegarde des données.
	 *
	 * @param WC_Product $product Objet produit.
	 */
	public function save_product_data( $product ) {
		$enabled      = isset( $_POST['_wc_pc13_enabled'] ) ? 'yes' : 'no';
		$mode         = isset( $_POST['_wc_pc13_mode'] ) ? sanitize_text_field( wp_unslash( $_POST['_wc_pc13_mode'] ) ) : 'peripheral';
		$hands        = isset( $_POST['_wc_pc13_default_hands'] ) ? sanitize_text_field( wp_unslash( $_POST['_wc_pc13_default_hands'] ) ) : 'classic';
		$accent_color = isset( $_POST['_wc_pc13_default_color'] ) ? sanitize_hex_color( wp_unslash( $_POST['_wc_pc13_default_color'] ) ) : '#111111';
		$diameter     = isset( $_POST['_wc_pc13_default_diameter'] ) ? absint( wp_unslash( $_POST['_wc_pc13_default_diameter'] ) ) : 30;

		$product->update_meta_data( '_wc_pc13_enabled', $enabled );
		$product->update_meta_data( '_wc_pc13_mode', $mode );
		$product->update_meta_data( '_wc_pc13_default_hands', $hands );

		if ( $accent_color ) {
			$product->update_meta_data( '_wc_pc13_default_color', $accent_color );
		} else {
			$product->delete_meta_data( '_wc_pc13_default_color' );
		}

		if ( $diameter ) {
			$product->update_meta_data( '_wc_pc13_default_diameter', $diameter );
		} else {
			$product->delete_meta_data( '_wc_pc13_default_diameter' );
		}
	}
}


