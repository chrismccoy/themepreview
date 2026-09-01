<?php
/**
 * Transient cache, refresh locking, and the generation counter.
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

final class ThemeCache
{
    /**
     * Soft expiry in seconds.
     */
    public const TTL = 300;

    /**
     * Hard expiry in seconds.
     */
    public const MAX_TTL = 1800;

    /**
     * Seconds a refresh lock is held, capping rebuild frequency.
     */
    public const LOCK_TTL = 30;

    /**
     * Transient key prefix for cached REST responses.
     */
    private const CACHE_PREFIX = 'th_themes_';

    /**
     * Transient key prefix for refresh locks.
     */
    private const LOCK_PREFIX = 'th_themes_lock_';

    /**
     * Object cache group used for locks on persistent backends.
     */
    private const CACHE_GROUP = 'th_themes';

    /**
     * Option holding the cache generation counter.
     */
    private const VERSION_OPTION = 'th_theme_cache_version';

    /**
     * Generation counter for this request.
     */
    private ?int $version = null;

    /**
     * Whether the counter was already bumped this request.
     */
    private bool $flushed = false;

    /**
     * Returns the cache generation counter, read once per request.
     */
    public function version(): int
    {
        if (null === $this->version) {
            $this->version = max(1, (int) get_option(self::VERSION_OPTION, 1));
        }

        return $this->version;
    }

    /**
     * Bumps the generation counter, invalidating every cached page.
     */
    public function flush(): void
    {
        if ($this->flushed) {
            return;
        }

        $this->flushed = true;

        $version = max(1, (int) get_option(self::VERSION_OPTION, 1));
        update_option(self::VERSION_OPTION, $version + 1);

        $this->version = $version + 1;
    }

    /**
     * Builds the transient key for a category and page.
     */
    public function key(string $category, int $page): string
    {
        return self::CACHE_PREFIX . md5($category . '|' . $page);
    }

    /**
     * Reads a cached payload.
     */
    public function read(string $key)
    {
        return get_transient($key);
    }

    /**
     * Stores a payload until the hard expiry.
     */
    public function write(string $key, array $payload): void
    {
        set_transient($key, $payload, self::MAX_TTL);
    }

    /**
     * Checks that a cached value is usable
     */
    public function is_payload($value): bool
    {
        return is_array($value)
            && isset($value['data'], $value['total'], $value['pages'], $value['version'], $value['generated'])
            && is_array($value['data']);
    }

    /**
     * Checks that a payload is both current and inside the soft TTL.
     */
    public function is_fresh($payload, int $now): bool
    {
        return $this->is_payload($payload)
            && (int) $payload['version'] === $this->version()
            && ($now - (int) $payload['generated']) < self::TTL;
    }

    /**
     * Takes the refresh lock for one cache key.
     */
    public function acquire_lock(string $key): bool
    {
        $lock_key = self::LOCK_PREFIX . $key;

        if (wp_using_ext_object_cache()) {
            return (bool) wp_cache_add($lock_key, 1, self::CACHE_GROUP, self::LOCK_TTL);
        }

        if (false !== get_transient($lock_key)) {
            return false;
        }

        set_transient($lock_key, 1, self::LOCK_TTL);

        return true;
    }

    /**
     * Releases a refresh lock this request acquired.
     */
    public function release_lock(string $key): void
    {
        $lock_key = self::LOCK_PREFIX . $key;

        if (wp_using_ext_object_cache()) {
            wp_cache_delete($lock_key, self::CACHE_GROUP);

            return;
        }

        delete_transient($lock_key);
    }
}
