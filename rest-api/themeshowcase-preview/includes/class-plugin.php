<?php
/**
 * Plugin
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

final class Plugin
{
    /**
     * Singleton instance.
     */
    private static ?Plugin $instance = null;

    /**
     * Post type and taxonomy registration.
     */
    private ContentTypes $content_types;

    /**
     * Known category slugs.
     */
    private CategorySlugs $slugs;

    /**
     * Builds the plugin once
     */
    public static function boot(string $plugin_file): void
    {
        if (null === self::$instance) {
            self::$instance = new self($plugin_file);
        }
    }

    /**
     * Retrieves the plugin instance
     */
    public static function instance(): ?Plugin
    {
        return self::$instance;
    }

    /**
     * Activation hook. Registers content types and seeds the slug option.
     */
    public static function activate(): void
    {
        $plugin = self::$instance;

        if (null === $plugin) {
            return;
        }

        $plugin->content_types->register();
        $plugin->slugs->refresh();
    }

    /**
     * Builds and registers  hooks.
     */
    private function __construct(string $plugin_file)
    {
        $plugin_dir = plugin_dir_path($plugin_file);
        $plugin_url = plugin_dir_url($plugin_file);

        $cache = new ThemeCache();
        $this->slugs = new CategorySlugs();
        $this->content_types = new ContentTypes();

        $this->content_types->register_hooks();
        (new ThemeMetabox($plugin_dir, $plugin_url))->register_hooks();
        (new CacheInvalidator($cache, $this->slugs))->register_hooks();
        $this->slugs->register_hooks();
        (new ThemesController($cache, $this->slugs, new ThemeRepository()))->register_hooks();
    }
}
