/**
 * Reading values out of HTTP response headers.
 */

/**
 * Reads `max-age` out of a `Cache-Control` header.
 */
export function readMaxAgeMs(header) {
  if (!header) return null;
  const match = /max-age\s*=\s*(\d+)/i.exec(header);
  return match ? Number(match[1]) * 1000 : null;
}

/**
 * Reads a non-negative integer header.
 */
export function readHeaderIntOrDefault(header, fallback) {
  if (header === null || header === undefined || header === "") return fallback;
  const value = Number(header);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
