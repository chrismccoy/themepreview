/**
 * Values every view receives, whichever route rendered it.
 */

import crypto from "node:crypto";

/**
 * Attaches the per request nonce and the font configuration.
 */
export function viewLocals(config) {
  return (req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString("base64");
    res.locals.fonts = config.fonts;
    next();
  };
}
