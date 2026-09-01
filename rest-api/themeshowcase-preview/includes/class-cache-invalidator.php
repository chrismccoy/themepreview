<?php
/**
 * Events that invalidate caches
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Bumps the cache generation whenever theme content changes.
 */
final class CacheInvalidator
{
    /**
     * Cache whose generation counter is bumped.
     */
    private ThemeCache $cache;

    /**
     * Slug list, rebuilt when a category itself changes.
     */
    private CategorySlugs $slugs;

    /**
     * Constructor.
     */
    public function __construct(ThemeCache $cache, CategorySlugs $slugs)
    {
        $this->cache = $cache;
        $this->slugs = $slugs;
    }

    /**
     * Registers the hooks
     */
    public function register_hooks(): void
    {
        add_action('save_post_' . ContentTypes::CPT_SLUG, [$this, 'on_save']);

        add_action('deleted_post', [$this, 'on_post_change'], 10, 2);
        add_action('trashed_post', [$this, 'on_post_change']);
        add_action('untrashed_post', [$this, 'on_post_change']);

        add_action('set_object_terms', [$this, 'on_terms_set'], 10, 4);

        add_action('created_term', [$this, 'on_term_change'], 10, 3);
        add_action('edited_term', [$this, 'on_term_change'], 10, 3);
        add_action('delete_term', [$this, 'on_term_change'], 10, 3);
    }

    /**
     * Invalidates after a theme is saved.
     */
    public function on_save(int $post_id): void
    {
        if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || wp_is_post_revision($post_id)) {
            return;
        }

        $this->cache->flush();
    }

    /**
     * Invalidates when a post is deleted, trashed, or restored.
     */
    public function on_post_change(int $post_id, ?\WP_Post $post = null): void
    {
        $post_type = $post instanceof \WP_Post ? $post->post_type : get_post_type($post_id);

        if (ContentTypes::CPT_SLUG !== $post_type) {
            return;
        }

        $this->cache->flush();
    }

    /**
     * Invalidates when theme categories are reassigned.
     */
    public function on_terms_set($object_id, $terms, $tt_ids, $taxonomy): void
    {
        if (ContentTypes::TAX_SLUG !== $taxonomy) {
            return;
        }

        $this->cache->flush();
    }

    /**
     * Invalidates when a theme category itself is created, edited, or removed.
     */
    public function on_term_change($term_id, $tt_id, $taxonomy): void
    {
        if (ContentTypes::TAX_SLUG !== $taxonomy) {
            return;
        }

        $this->slugs->mark_dirty();
        $this->cache->flush();
    }
}
