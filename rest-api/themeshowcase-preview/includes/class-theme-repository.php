<?php
/**
 * Reading themes out of the database for the REST response.
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

final class ThemeRepository
{
    /**
     * Maximum number of themes returned per request.
     */
    public const PER_PAGE = 100;

    /**
     * Reads one page of published themes, formatted for the response.
     */
    public function page(string $category, int $page): array
    {
        $args = [
            'post_type' => ContentTypes::CPT_SLUG,
            'post_status' => 'publish',
            'posts_per_page' => self::PER_PAGE,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'ASC',
            'ignore_sticky_posts' => true,
            'no_found_rows' => true,
        ];

        if ('' !== $category) {
            $args['tax_query'] = $this->tax_query($category);
        }

        $query = new \WP_Query($args);
        $posts = $query->posts;
        $count = count($posts);

        if ($count > 0 && $count < self::PER_PAGE) {
            $total = (($page - 1) * self::PER_PAGE) + $count;
        } elseif (0 === $count && 1 === $page) {
            $total = 0;
        } else {
            $total = $this->count($category);
        }

        $attachment_map = $this->prime_caches($posts);

        $data = [];
        foreach ($posts as $post) {
            $data[] = $this->format($post, $attachment_map[$post->ID] ?? []);
        }

        return [
            'data' => $data,
            'total' => $total,
            'pages' => $total > 0 ? (int) ceil($total / self::PER_PAGE) : 0,
        ];
    }

    /**
     * Counts published themes, optionally within one category.
     */
    public function count(string $category): int
    {
        $args = [
            'post_type' => ContentTypes::CPT_SLUG,
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'fields' => 'ids',
            'ignore_sticky_posts' => true,
            'no_found_rows' => false,
        ];

        if ('' !== $category) {
            $args['tax_query'] = $this->tax_query($category);
        }

        $query = new \WP_Query($args);

        return (int) $query->found_posts;
    }

    /**
     * Builds the taxonomy clause for a category slug.
     */
    private function tax_query(string $category): array
    {
        return [
            [
                'taxonomy' => ContentTypes::TAX_SLUG,
                'field' => 'slug',
                'terms' => $category,
            ],
        ];
    }

    /**
     * Primes the object cache for every attachment
     */
    private function prime_caches(array $posts): array
    {
        if (empty($posts)) {
            return [];
        }

        $map = [];
        $attachment_ids = [];

        foreach ($posts as $post) {
            $image_id = (int) get_post_meta($post->ID, ContentTypes::META_IMAGE, true);
            $thumbnail_id = (int) get_post_meta($post->ID, '_thumbnail_id', true);

            $map[$post->ID] = [
                'image' => $image_id,
                'thumbnail' => $thumbnail_id,
            ];

            if ($image_id) {
                $attachment_ids[] = $image_id;
            }

            if ($thumbnail_id) {
                $attachment_ids[] = $thumbnail_id;
            }
        }

        $attachment_ids = array_values(array_unique($attachment_ids));

        if (!empty($attachment_ids)) {
            _prime_post_caches($attachment_ids, false, true);
        }

        return $map;
    }

    /**
     * Formats a single `th_theme` post into a REST friendly array.
     */
    private function format(\WP_Post $post, array $attachment_ids): array
    {
        $terms = get_the_terms($post->ID, ContentTypes::TAX_SLUG);
        $category = (!is_wp_error($terms) && !empty($terms))
            ? $terms[0]->name
            : __('Uncategorized', 'themeshowcase-previewer');

        $image_id = (int) ($attachment_ids['image'] ?? 0);
        $image = $image_id ? wp_get_attachment_image_url($image_id, 'large') : '';

        if (!$image) {
            $thumbnail_id = (int) ($attachment_ids['thumbnail'] ?? 0);
            $image = $thumbnail_id ? wp_get_attachment_image_url($thumbnail_id, 'large') : '';
        }

        return [
            'id' => $post->post_name,
            'name' => get_the_title($post->ID),
            'category' => $category,
            'image' => $image ?: '',
            'url' => get_post_meta($post->ID, ContentTypes::META_URL, true),
        ];
    }
}
