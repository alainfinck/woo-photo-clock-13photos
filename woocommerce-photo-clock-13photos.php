<?php
/**
 * Plugin Name: WooCommerce Photo Clock 13 Photos
 * Plugin URI: https://example.com/
 * Description: Personnalisation d'une horloge avec 12 photos horaires et 1 photo centrale pour WooCommerce, avec prévisualisation en direct.
 * Version: 1.0.0
 * Author: GPT-5 Codex
 * License: GPL2
 * Text Domain: wc-photo-clock-13
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WC_PC13_PLUGIN_FILE', __FILE__ );
define( 'WC_PC13_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WC_PC13_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

final class WC_Photo_Clock_13 {

	/**
	 * Instance unique.
	 *
	 * @var WC_Photo_Clock_13|null
	 */
	protected static $instance = null;

	/**
	 * Récupère l'instance singleton.
	 *
	 * @return WC_Photo_Clock_13
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
		$this->includes();
		$this->hooks();
	}

	/**
	 * Charge les fichiers requis.
	 */
	private function includes() {
		require_once WC_PC13_PLUGIN_DIR . 'includes/class-wc-pc13-assets.php';
		require_once WC_PC13_PLUGIN_DIR . 'includes/class-wc-pc13-admin.php';
		require_once WC_PC13_PLUGIN_DIR . 'includes/class-wc-pc13-product-settings.php';
		require_once WC_PC13_PLUGIN_DIR . 'includes/class-wc-pc13-ajax.php';
		require_once WC_PC13_PLUGIN_DIR . 'includes/class-wc-pc13-frontend.php';
		require_once WC_PC13_PLUGIN_DIR . 'includes/class-wc-pc13-cart.php';
	}

	/**
	 * Enregistre les hooks principaux.
	 */
	private function hooks() {
		register_activation_hook( WC_PC13_PLUGIN_FILE, array( $this, 'activate' ) );
		add_action( 'plugins_loaded', array( $this, 'maybe_bootstrap' ) );
		add_action( 'init', array( $this, 'load_textdomain' ) );
	}

	/**
	 * Charge le textdomain.
	 */
	public function load_textdomain() {
		load_plugin_textdomain( 'wc-photo-clock-13', false, dirname( plugin_basename( WC_PC13_PLUGIN_FILE ) ) . '/languages' );
	}

	/**
	 * Vérifie la présence de WooCommerce avant de poursuivre.
	 */
	public function maybe_bootstrap() {
		if ( class_exists( 'WooCommerce' ) ) {
			WC_PC13_Assets::instance();
			WC_PC13_Admin::instance();
			WC_PC13_Product_Settings::instance();
			WC_PC13_Ajax::instance();
			WC_PC13_Frontend::instance();
			WC_PC13_Cart::instance();
		} else {
			add_action( 'admin_notices', array( $this, 'woocommerce_missing_notice' ) );
		}
	}

	/**
	 * Tâches à l'activation.
	 */
	public function activate() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			deactivate_plugins( plugin_basename( WC_PC13_PLUGIN_FILE ) );
			wp_die(
				esc_html__( 'WooCommerce Photo Clock 13 Photos requiert WooCommerce pour fonctionner.', 'wc-photo-clock-13' ),
				esc_html__( 'Erreur d’activation', 'wc-photo-clock-13' ),
				array( 'back_link' => true )
			);
		}
	}

	/**
	 * Affiche un message si WooCommerce manque.
	 */
	public function woocommerce_missing_notice() {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			esc_html__( 'WooCommerce Photo Clock 13 Photos nécessite que WooCommerce soit actif.', 'wc-photo-clock-13' )
		);
	}
}

WC_Photo_Clock_13::instance();


