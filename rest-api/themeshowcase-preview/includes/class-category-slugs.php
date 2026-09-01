<?php
/**
 * The list of valid category slugs, and its option
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

final class CategorySlugs
{
    /**
     * Option holding the valid category slug list.
     */
    private const OPTION = 'th_theme_cat_slug_list';

    /**
     * Largest slug list that stays autoloaded.
     */
    private const AUTOLOAD_MAX = 200;

    /**
     * Whether a rebuild is queued for shutdown.
     */
    private bool $dirty = false;

    /**
     * Slug list read without writing, when the option is missing.
     */
    private ?array $fallback = null;

    /**
     * Registers the hooks this class owns.
     */
    public function register_hooks(): void
    {
        add_action('admin_init', [$this, 'ensure']);
    }

    /**
     * Returns every `th_theme_cat` slug.
     */
    public function valid(): array
    {
        $slugs = get_option(self::OPTION, null);

        if (is_array($slugs)) {
            return $slugs;
        }

        if (null === $this->fallback) {
            $this->fallback = $this->read();
        }

        return $this->fallback;
    }

    /**
     * Writes the slug option if it has never been stored.
     */
    public function ensure(): void
    {
        if (!is_array(get_option(self::OPTION, null))) {
            $this->refresh();
        }
    }

    /**
     * Queues a rebuild for the end of the request.
     */
    public function mark_dirty(): void
    {
        if ($this->dirty) {
            return;
        }

        $this->dirty = true;

        add_action('shutdown', [$this, 'refresh_deferred']);
    }

    /**
     * Runs the queued rebuild.
     */
    public function refresh_deferred(): void
    {
        if (!$this->dirty) {
            return;
        }

        $this->dirty = false;

        $this->refresh();
    }

    /**
     * Rebuilds and stores the slug list.
     */
    public function refresh(): array
    {
        $slugs = $this->read();

        $autoload = count($slugs) <= self::AUTOLOAD_MAX;

        update_option(self::OPTION, $slugs, $autoload);

        $this->fallback = $slugs;

        return $slugs;
    }

    /**
     * Reads every `th_theme_cat` slug without storing anything.
     */
    private function read(): array
    {
        $terms = get_terms([
            'taxonomy' => ContentTypes::TAX_SLUG,
            'fields' => 'slugs',
            'hide_empty' => false,
        ]);

        return is_wp_error($terms) ? [] : array_map('strval', (array) $terms);
    }
}
