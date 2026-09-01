/**
 * Loads the environment, sets up the WordPress client into the cache
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, loadEnvFileIfPresent } from "./config/index.js";
import { createApiClient } from "./services/api-client.js";
import { createCache } from "./lib/cache.js";
import { createApp } from "./lib/app.js";

loadEnvFileIfPresent(path.dirname(fileURLToPath(import.meta.url)));

const config = loadConfig();

const apiClient = createApiClient(config);

/**
 * The theme cache, loading through the WordPress client.
 */
const cache = createCache({
  loader: async () => {
    const result = await apiClient.fetchThemes();

    if (result.pages > 1) {
      console.warn(
        `[themes] WordPress reports ${result.total} themes across ${result.pages} pages, ` +
          `but only the first is fetched: ${result.total - result.themes.length} are not shown.`
      );
    }

    return { value: result, ttlMs: result.maxAgeMs };
  },
  ttlMsOverride: config.cacheTtlMs,
  minTtlMs: config.cacheMinTtlMs,
  maxTtlMs: config.cacheMaxTtlMs,
  onError: (error) => console.error("[themes] background refresh failed:", error.message),
});

createApp({ config, cache }).listen(config.port, () => {
  console.log(`Theme previewer listening on http://localhost:${config.port}`);
});
