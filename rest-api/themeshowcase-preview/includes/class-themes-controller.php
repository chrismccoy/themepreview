<?php
/**
 * `/themeshowcase/v1/themes` REST route.
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Cache policy for the themes route.
 */
final class ThemesController
{
    /**
     * REST API namespace.
     */
    private const REST_NAMESPACE = 'themeshowcase/v1';

    /**
     * REST API route, relative to the namespace.
     */
    private const REST_ROUTE = '/themes';

    /**
     * Highest accepted `page` value.
     */
    private const MAX_PAGE = 100;

    /**
     * Cache holding rendered payloads.
     */
    private ThemeCache $cache;

    /**
     * Known category slugs, for validating the `category` parameter.
     */
    private CategorySlugs $slugs;

    /**
     * Source of theme rows.
     */
    private ThemeRepository $repository;

    /**
     * Constructor.
     */
    public function __construct(ThemeCache $cache, CategorySlugs $slugs, ThemeRepository $repository)
    {
        $this->cache = $cache;
        $this->slugs = $slugs;
        $this->repository = $repository;
    }

    /**
     * Registers the hooks
     */
    public function register_hooks(): void
    {
        add_action('rest_api_init', [$this, 'register_route']);
    }

    /**
     * Registers the REST route and its parameter schema.
     */
    public function register_route(): void
    {
        register_rest_route(self::REST_NAMESPACE, self::REST_ROUTE, [
            'methods' => \WP_REST_Server::READABLE,
            'callback' => [$this, 'get_themes'],
            'permission_callback' => '__return_true',
            'args' => [
                'category' => [
                    'type' => 'string',
                    'required' => false,
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => [$this, 'validate_category'],
                ],
                'page' => [
                    'type' => 'integer',
                    'required' => false,
                    'default' => 1,
                    'minimum' => 1,
                    'maximum' => self::MAX_PAGE,
                ],
            ],
        ]);
    }

    /**
     * Validates the `category` request parameter against existing terms.
     */
    public function validate_category($value)
    {
        if (null === $value || '' === $value) {
            return true;
        }

        if (!is_string($value)) {
            return new \WP_Error(
                'rest_invalid_param',
                __('The category parameter must be a string.', 'themeshowcase-previewer'),
                ['status' => 400]
            );
        }

        $slug = sanitize_text_field($value);

        if (!in_array($slug, $this->slugs->valid(), true)) {
            return new \WP_Error(
                'rest_invalid_param',
                __('Unknown category.', 'themeshowcase-previewer'),
                ['status' => 400]
            );
        }

        return true;
    }

    /**
     * Returns published themes as JSON.
     */
    public function get_themes(\WP_REST_Request $request): \WP_REST_Response
    {
        $category = (string) $request->get_param('category');
        $page = max(1, min(self::MAX_PAGE, (int) $request->get_param('page')));

        $key = $this->cache->key($category, $page);
        $version = $this->cache->version();
        $now = time();

        $cached = $this->cache->read($key);
        $has_payload = $this->cache->is_payload($cached);

        if ($this->cache->is_fresh($cached, $now)) {
            return $this->response($cached, $now);
        }

        if ($page > 1) {
            $first = $this->first_page_payload($category, $version);

            if (null !== $first && $page > (int) $first['pages']) {
                return $this->response(
                    $this->empty_payload($version, $now, (int) $first['total'], (int) $first['pages']),
                    $now,
                    ThemeCache::LOCK_TTL
                );
            }
        }

        if (!$this->cache->acquire_lock($key)) {
            if ($has_payload) {
                return $this->response($cached, $now);
            }

            return $this->response(
                $this->empty_payload($version, $now),
                $now,
                ThemeCache::LOCK_TTL
            );
        }

        $payload = $this->repository->page($category, $page)
            + ['version' => $version, 'generated' => $now];

        if (1 === $page || !empty($payload['data'])) {
            $this->cache->write($key, $payload);
        }

        $this->cache->release_lock($key);

        return $this->response($payload, $now);
    }

    /**
     * Returns the cached first page for a category, when it is current.
     */
    private function first_page_payload(string $category, int $version): ?array
    {
        $first = $this->cache->read($this->cache->key($category, 1));

        if (!$this->cache->is_payload($first) || (int) $first['version'] !== $version) {
            return null;
        }

        return $first;
    }

    /**
     * Builds a payload carrying no rows.
     */
    private function empty_payload(int $version, int $now, int $total = 0, int $pages = 0): array
    {
        return [
            'data' => [],
            'total' => $total,
            'pages' => $pages,
            'version' => $version,
            'generated' => $now,
        ];
    }

    /**
     * Builds the REST response from a payload.
     */
    private function response(array $payload, int $now, ?int $max_age = null): \WP_REST_Response
    {
        if (null === $max_age) {
            $age = max(0, $now - (int) $payload['generated']);
            $max_age = ThemeCache::TTL - $age;
        }

        if ($max_age < 1) {
            $max_age = ThemeCache::LOCK_TTL;
        }

        $response = rest_ensure_response($payload['data']);
        $response->header('X-WP-Total', (string) (int) $payload['total']);
        $response->header('X-WP-TotalPages', (string) (int) $payload['pages']);
        $response->header('Cache-Control', 'public, max-age=' . $max_age);

        return $response;
    }
}
