<?php
/**
 * Gestion des assets du plugin.
 *
 * @package WooCommercePhotoClock13
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_PC13_Assets {

	/**
	 * Instance.
	 *
	 * @var WC_PC13_Assets|null
	 */
	protected static $instance = null;

	/**
	 * Singleton.
	 *
	 * @return WC_PC13_Assets
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
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend' ) );
	}

	/**
	 * Assets admin.
	 *
	 * @param string $hook Hook courant.
	 */
	public function enqueue_admin( $hook ) {
		$screen = get_current_screen();

		if ( ! $screen ) {
			return;
		}

		$should_enqueue = false;

		if ( in_array( $hook, array( 'post.php', 'post-new.php' ), true ) && isset( $screen->post_type ) && 'product' === $screen->post_type ) {
			$should_enqueue = true;
		}

		if ( 'woocommerce_page_wc-pc13-settings' === $screen->id ) {
			$should_enqueue = true;
		}

		if ( ! $should_enqueue ) {
			return;
		}

		wp_enqueue_style(
			'wc-pc13-admin',
			WC_PC13_PLUGIN_URL . 'assets/css/admin.css',
			array( 'wp-color-picker' ),
			'1.0.0'
		);

		wp_enqueue_script(
			'wc-pc13-admin',
			WC_PC13_PLUGIN_URL . 'assets/js/admin.js',
			array( 'jquery', 'wp-color-picker' ),
			'1.0.0',
			true
		);
	}

	/**
	 * Assets frontend.
	 */
	public function enqueue_frontend() {
		if ( ! is_product() ) {
			return;
		}

		global $post;
		if ( ! $post instanceof WP_Post ) {
			return;
		}

		$enabled = get_post_meta( $post->ID, '_wc_pc13_enabled', true );
		if ( 'yes' !== $enabled ) {
			return;
		}

		$default_show_slots = get_post_meta( $post->ID, '_wc_pc13_default_show_slots', true );
		// Par défaut, les photos périphériques sont activées si la meta n'existe pas
		$show_slots_value = $default_show_slots ? $default_show_slots : 'yes';

		$settings = class_exists( 'WC_PC13_Admin' ) ? WC_PC13_Admin::instance()->get_settings() : array(
			'default_hands'   => 'classic',
			'default_color'   => '#111111',
			'max_upload_size' => 10,
		);

		$max_upload_bytes = absint( $settings['max_upload_size'] ) * 1024 * 1024;

		wp_enqueue_style(
			'wc-pc13-dropzone',
			'https://cdnjs.cloudflare.com/ajax/libs/dropzone/5.9.3/min/dropzone.min.css',
			array(),
			'5.9.3'
		);

		wp_enqueue_style(
			'wc-pc13-frontend',
			WC_PC13_PLUGIN_URL . 'assets/css/frontend.css',
			array( 'wc-pc13-dropzone' ),
			'1.0.0'
		);

		wp_enqueue_script(
			'wc-pc13-dropzone',
			'https://cdnjs.cloudflare.com/ajax/libs/dropzone/5.9.3/min/dropzone.min.js',
			array(),
			'5.9.3',
			true
		);

		wp_enqueue_script(
			'wc-pc13-frontend',
			WC_PC13_PLUGIN_URL . 'assets/js/frontend-configurator.js',
			array( 'jquery', 'wc-pc13-dropzone' ),
			'1.0.0',
			true
		);

		wp_localize_script(
			'wc-pc13-frontend',
			'WCPC13',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'wc_pc13_nonce' ),
				'plugin_url' => trailingslashit( WC_PC13_PLUGIN_URL ),
				'cart_url' => wc_get_cart_url(),
				'labels'   => array(
					'upload_error' => __( 'Erreur lors de l\'envoi du fichier.', 'wc-photo-clock-13' ),
					'empty'        => __( 'Photo', 'wc-photo-clock-13' ),
					'file_too_large' => sprintf(
						/* translators: %s: valeur numérique en Mo. */
						__( 'Le fichier dépasse la taille maximale autorisée (%s Mo).', 'wc-photo-clock-13' ),
						number_format_i18n( $settings['max_upload_size'] )
					),
					'dropzone_message' => __( 'Déposez une photo ici ou cliquez pour sélectionner.', 'wc-photo-clock-13' ),
					'preview_error'    => __( 'Impossible de préparer la prévisualisation.', 'wc-photo-clock-13' ),
					'loading_unsplash' => __( 'Chargement des photos...', 'wc-photo-clock-13' ),
					'unsplash_error'    => __( 'Erreur lors du chargement des photos Unsplash.', 'wc-photo-clock-13' ),
					'fill_unsplash'     => __( 'Charger des photos aléatoires', 'wc-photo-clock-13' ),
					'help_required_fields' => __( 'Tous les champs sont requis.', 'wc-photo-clock-13' ),
					'help_success' => __( 'Message envoyé avec succès !', 'wc-photo-clock-13' ),
					'help_error' => __( 'Une erreur est survenue lors de l\'envoi.', 'wc-photo-clock-13' ),
					'help_submit' => __( 'Envoyer', 'wc-photo-clock-13' ),
					'sending' => __( 'Envoi en cours...', 'wc-photo-clock-13' ),
				),
				'settings' => array(
					'max_upload_bytes' => $max_upload_bytes,
					'default_show_slots' => 'yes' === $show_slots_value ? true : false,
				),
			)
		);
	}
}


