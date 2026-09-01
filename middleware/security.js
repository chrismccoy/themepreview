/**
 * Security headers, and the content security policy
 */

import helmet from "helmet";

/**
 * Builds the helmet middleware for this configuration.
 */
export function security(config) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
        "style-src": ["'self'", ...config.fonts.styleHosts],
        "font-src": ["'self'", ...config.fonts.fontHosts],
        "img-src": ["'self'", "data:", ...config.imageHosts],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "upgrade-insecure-requests": config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}
