/**
 * A single value cache
 */

/**
 * TTL used when a loader reports none.
 */
const DEFAULT_TTL_MS = 300_000;

/**
 * Creates the cache.
 */
export function createCache({
  loader,
  ttlMsOverride = null,
  minTtlMs = 0,
  maxTtlMs = Infinity,
  now = Date.now,
  onError = () => {},
}) {
  let value = null;
  let hasValue = false;
  let storedAt = 0;
  let expiresAt = 0;
  let lastError = null;
  let lastSuccessAt = null;
  let inFlight = null;

  /**
   * Decides how long a loaded value stays fresh.
   */
  function resolveTtl(reported) {
    const chosen = ttlMsOverride ?? (Number.isFinite(reported) ? reported : DEFAULT_TTL_MS);
    return Math.min(Math.max(chosen, minTtlMs), maxTtlMs);
  }

  /**
   * Runs the loader
   */
  function load() {
    if (inFlight) return inFlight;

    inFlight = Promise.resolve()
      .then(loader)
      .then((result) => {
        value = result.value;
        hasValue = true;
        storedAt = now();
        expiresAt = storedAt + resolveTtl(result.ttlMs);
        lastError = null;
        lastSuccessAt = storedAt;
        return value;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  /**
   * Reads the cache, loading or refreshing as needed.
   */
  async function get() {
    if (!hasValue) {
      const loaded = await load().catch((error) => {
        lastError = String(error?.message ?? error);
        throw error;
      });
      return { value: loaded, stale: false, refresh: null };
    }

    if (now() < expiresAt) {
      return { value, stale: false, refresh: null };
    }

    const refresh = load().catch((error) => {
      lastError = String(error?.message ?? error);
      onError(error);
    });

    return { value, stale: true, refresh };
  }

  /**
   * Reports cache health without touching the loader.
   */
  function peek() {
    return {
      hasValue,
      ageMs: hasValue ? now() - storedAt : null,
      expiresAt: hasValue ? expiresAt : null,
      lastSuccessAt,
      lastError,
    };
  }

  return { get, peek };
}
