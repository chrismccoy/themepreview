<?php
/**
 * Post type, taxonomy, and meta keys.
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Registers what a theme is.
 */
final class ContentTypes
{
    /**
     * Custom post type slug.
     */
    public const CPT_SLUG = 'th_theme';

    /**
     * Taxonomy slug.
     */
    public const TAX_SLUG = 'th_theme_cat';

    /**
     * Post meta key storing the preview image attachment ID.
     */
    public const META_IMAGE = '_th_theme_image_id';

    /**
     * Post meta key storing the demo URL.
     */
    public const META_URL = '_th_theme_demo_url';

    /**
     * Registers the hooks this class owns.
     */
    public function register_hooks(): void
    {
        add_action('init', [$this, 'register']);
    }

    /**
     * Registers the post type and the taxonomy.
     */
    public function register(): void
    {
        $this->register_post_type();
        $this->register_taxonomy();
    }

    /**
     * Registers the `th_theme` custom post type.
     */
    public function register_post_type(): void
    {
        register_post_type(self::CPT_SLUG, [
            'label' => __('Themes', 'themeshowcase-previewer'),
            'labels' => [
                'name' => __('Themes', 'themeshowcase-previewer'),
                'singular_name' => __('Theme', 'themeshowcase-previewer'),
                'add_new_item' => __('Add New Theme', 'themeshowcase-previewer'),
                'edit_item' => __('Edit Theme', 'themeshowcase-previewer'),
            ],
            'public' => true,
            'show_in_rest' => true,
            'has_archive' => false,
            'menu_icon' => 'dashicons-art',
            'supports' => ['title', 'thumbnail'],
            'rewrite' => ['slug' => 'themes'],
            'capability_type' => 'post',
        ]);
    }

    /**
     * Registers the `th_theme_cat` taxonomy.
     */
    public function register_taxonomy(): void
    {
        register_taxonomy(self::TAX_SLUG, self::CPT_SLUG, [
            'label' => __('Categories', 'themeshowcase-previewer'),
            'labels' => [
                'name' => __('Categories', 'themeshowcase-previewer'),
                'singular_name' => __('Category', 'themeshowcase-previewer'),
            ],
            'public' => true,
            'show_in_rest' => true,
            'hierarchical' => true,
            'rewrite' => ['slug' => 'theme-category'],
        ]);
    }
}
