/**
 * Reports cache health.
 */

/**
 * Builds the handler for `GET /health`.
 */
export function createHealthHandler({ cache }) {
  return function reportHealth(req, res) {
    const info = cache.peek();
    res.set("Cache-Control", "no-store").json({
      status: info.lastError ? "degraded" : "ok",
      ...info,
    });
  };
}
