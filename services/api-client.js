/**
 * WordPress themes route.
 */

import { normalizeTheme } from "../models/theme.js";
import { readMaxAgeMs, readHeaderIntOrDefault } from "../utils/headers.js";

/**
 * WordPress result, but not with a usable themes payload.
 */
export class ApiError extends Error {
  /**
   * @param {number} status  HTTP status that came back.
   * @param {string} message Human-readable explanation.
   */
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Builds a client for the WordPress themes route.
 */
export function createApiClient({ wpApiBase, wpTimeoutMs, fetchImpl = fetch }) {
  /**
   * Fetches the first page of themes.
   */
  async function fetchThemes() {
    const url = `${wpApiBase}/themes?page=1`;
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(wpTimeoutMs),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new ApiError(response.status, `WordPress responded ${response.status}`);
    }

    const body = await response.json();
    if (!Array.isArray(body)) {
      throw new ApiError(response.status, "Expected the themes route to return an array");
    }

    const themes = body.map(normalizeTheme).filter(Boolean);

    return {
      themes,
      total: readHeaderIntOrDefault(response.headers.get("X-WP-Total"), themes.length),
      pages: readHeaderIntOrDefault(response.headers.get("X-WP-TotalPages"), themes.length ? 1 : 0),
      maxAgeMs: readMaxAgeMs(response.headers.get("Cache-Control")),
    };
  }

  return { fetchThemes };
}
