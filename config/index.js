/**
 * Reads and validates everything the application needs (.env file)
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Screenshot used when a theme has none
 */
const DEFAULT_FALLBACK_IMAGE = "/img/placeholder.svg";

/**
 * Webfont stylesheet
 */
const DEFAULT_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:wght@400;500&display=swap";

/**
 * Origin the webfont files themselves are served from.
 */
const DEFAULT_FONT_FILE_HOST = "https://fonts.gstatic.com";

/**
 * Shortest TTL the cache will honor, in milliseconds.
 */
const DEFAULT_MIN_TTL_MS = 60_000;

/**
 * Longest TTL the cache will use
 */
const DEFAULT_MAX_TTL_MS = 900_000;

/**
 * Loads a `.env`
 */
export function loadEnvFileIfPresent(dir) {
  const file = path.join(dir, ".env");
  if (!fs.existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

/**
 * Reads a positive integer from the environment.
 */
function readPositiveIntOrThrow(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}"`);
  }
  return value;
}

/**
 * Extracts the origin of a URL, for the content security policy.
 */
function origin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Reads a comma separated list of origins.
 */
function parseOrigins(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => origin(entry.trim()))
    .filter(Boolean);
}

/**
 * Resolves webfont delivery, for the markup and the policy together.
 */
function parseFonts(env) {
  const stylesheet =
    env.FONT_STYLESHEET === undefined ? DEFAULT_FONT_STYLESHEET : env.FONT_STYLESHEET;
  const fileHost =
    env.FONT_FILE_HOST === undefined ? DEFAULT_FONT_FILE_HOST : env.FONT_FILE_HOST;

  if (!stylesheet) return { stylesheet: null, styleHosts: [], fontHosts: [] };

  return {
    stylesheet,
    styleHosts: [origin(stylesheet)].filter(Boolean),
    fontHosts: [origin(fileHost)].filter(Boolean),
  };
}

/**
 * Parses the header navigation links.
 */
function parseNavLinks(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.split("|").map((part) => part.trim()))
    .filter(([label, href]) => label && href)
    .map(([label, href]) => ({ label, href }));
}

/**
 * Builds the validated configuration object.
 */
export function loadConfig(env = process.env) {
  const base = env.WP_API_BASE;
  if (!base) {
    throw new Error(
      "WP_API_BASE is required, e.g. https://example.com/wp-json/themeshowcase/v1"
    );
  }
  if (!origin(base)) {
    throw new Error(`WP_API_BASE must be an absolute URL, received "${base}"`);
  }

  const fallbackImage = env.FALLBACK_IMAGE || DEFAULT_FALLBACK_IMAGE;

  const imageHosts = [
    origin(base),
    origin(fallbackImage),
    ...parseOrigins(env.IMAGE_HOSTS),
  ].filter(Boolean);

  return {
    port: readPositiveIntOrThrow(env, "PORT", 3000),
    wpApiBase: base.replace(/\/+$/, ""),
    wpTimeoutMs: readPositiveIntOrThrow(env, "WP_TIMEOUT_MS", 5000),
    cacheTtlMs: env.CACHE_TTL_MS ? readPositiveIntOrThrow(env, "CACHE_TTL_MS", null) : null,
    cacheMinTtlMs: readPositiveIntOrThrow(env, "CACHE_MIN_TTL_MS", DEFAULT_MIN_TTL_MS),
    cacheMaxTtlMs: readPositiveIntOrThrow(env, "CACHE_MAX_TTL_MS", DEFAULT_MAX_TTL_MS),
    fallbackImage,
    fonts: parseFonts(env),
    navLinks: parseNavLinks(env.NAV_LINKS),
    imageHosts: [...new Set(imageHosts)],
    isProduction: env.NODE_ENV === "production",
  };
}
