<?php
/**
 * Theme Details metabox
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * The admin metabox for a theme's demo URL and preview image.
 */
final class ThemeMetabox
{
    /**
     * Nonce action name used for saving the metabox.
     */
    private const NONCE_ACTION = 'th_theme_save';

    /**
     * Nonce field name rendered in the metabox form.
     */
    private const NONCE_FIELD = 'th_theme_nonce';

    /**
     * Plugin version, used for cache-busting enqueued assets.
     */
    private const VERSION = '1.0.0';

    /**
     * Absolute path to the plugin directory, with a trailing slash.
     */
    private string $plugin_dir;

    /**
     * URL of the plugin directory, with a trailing slash.
     */
    private string $plugin_url;

    /**
     * Constructor.
     */
    public function __construct(string $plugin_dir, string $plugin_url)
    {
        $this->plugin_dir = $plugin_dir;
        $this->plugin_url = $plugin_url;
    }

    /**
     * Registers the hooks
     */
    public function register_hooks(): void
    {
        add_action('add_meta_boxes', [$this, 'register']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('save_post_' . ContentTypes::CPT_SLUG, [$this, 'save'], 10, 2);
    }

    /**
     * Adds the metabox to the `th_theme` edit screen.
     */
    public function register(): void
    {
        add_meta_box(
            'th_theme_details',
            __('Theme Details', 'themeshowcase-previewer'),
            [$this, 'render'],
            ContentTypes::CPT_SLUG,
            'normal',
            'high'
        );
    }

    /**
     * Renders the metabox markup by including the view template.
     */
    public function render(\WP_Post $post): void
    {
        wp_nonce_field(self::NONCE_ACTION, self::NONCE_FIELD);

        $image_id = (int) get_post_meta($post->ID, ContentTypes::META_IMAGE, true);
        $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'large') : '';
        $demo_url = get_post_meta($post->ID, ContentTypes::META_URL, true);

        include $this->plugin_dir . 'views/metabox.php';
    }

    /**
     * Enqueues the media picker script, on the `th_theme` editor screen only.
     */
    public function enqueue_assets(string $hook): void
    {
        if (!in_array($hook, ['post.php', 'post-new.php'], true)) {
            return;
        }

        $screen = get_current_screen();
        if (!$screen || $screen->post_type !== ContentTypes::CPT_SLUG) {
            return;
        }

        wp_enqueue_media();

        wp_enqueue_script(
            'th-theme-metabox',
            $this->plugin_url . 'assets/js/metabox.js',
            ['jquery', 'media-editor'],
            self::VERSION,
            true
        );

        wp_localize_script('th-theme-metabox', 'thThemeMetabox', [
            'title' => __('Pick Preview Image', 'themeshowcase-previewer'),
            'buttonText' => __('Use image', 'themeshowcase-previewer'),
        ]);
    }

    /**
     * Saves the metabox fields as post meta.
     */
    public function save(int $post_id, \WP_Post $post): void
    {
        if (
            !isset($_POST[self::NONCE_FIELD]) ||
            !wp_verify_nonce(
                sanitize_text_field(wp_unslash($_POST[self::NONCE_FIELD])),
                self::NONCE_ACTION
            )
        ) {
            return;
        }

        if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || wp_is_post_revision($post_id)) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        if (isset($_POST['th_theme_demo_url'])) {
            update_post_meta(
                $post_id,
                ContentTypes::META_URL,
                esc_url_raw(wp_unslash($_POST['th_theme_demo_url']))
            );
        }

        if (isset($_POST['th_theme_image_id'])) {
            update_post_meta(
                $post_id,
                ContentTypes::META_IMAGE,
                absint($_POST['th_theme_image_id'])
            );
        }
    }
}
