/**
 * Serves theme screenshots from this origin, so the WordPress host stays hidden
 */

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The placeholder bytes, read once at startup.
 */
const PLACEHOLDER = fs.readFileSync(path.join(rootDir, "public", "img", "placeholder.svg"));

/**
 * How long a browser may keep a proxied screenshot.
 */
const HIT_MAX_AGE_SECONDS = 300;

/**
 * How long a browser may keep the placeholder.
 */
const PLACEHOLDER_MAX_AGE_SECONDS = 60;

/**
 * Returns with the local placeholder
 */
function sendPlaceholder(res) {
  res
    .status(200)
    .set("Content-Type", "image/svg+xml")
    .set("Cache-Control", `public, max-age=${PLACEHOLDER_MAX_AGE_SECONDS}`)
    .send(PLACEHOLDER);
}

function setValidators(res, result) {
  if (result.etag) res.set("ETag", result.etag);
  if (result.lastModified) res.set("Last-Modified", result.lastModified);
}

/**
 * Builds the handler for `GET /media/theme/:id`.
 */
export function createMediaHandler({ cache, imageSource }) {
  return async function serveThemeImage(req, res) {
    let themes;
    try {
      const hit = await cache.get();
      themes = hit.value.themes;
    } catch {
      return sendPlaceholder(res);
    }

    const theme = themes.find((candidate) => candidate.id === req.params.id);
    if (!theme) {
      return res.status(404).set("Cache-Control", "no-store").type("txt").send("Not found");
    }
    if (!theme.image) return sendPlaceholder(res);

    let result;
    try {
      result = await imageSource.fetchImage(theme.image, {
        ifNoneMatch: req.get("If-None-Match"),
        ifModifiedSince: req.get("If-Modified-Since"),
      });
    } catch {
      return sendPlaceholder(res);
    }

    if (result.status === 304) {
      setValidators(res, result);
      return res.status(304).end();
    }

    res
      .status(200)
      .set("Content-Type", result.contentType)
      .set("Cache-Control", `public, max-age=${HIT_MAX_AGE_SECONDS}`);
    setValidators(res, result);

    const stream = Readable.fromWeb(result.body);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  };
}
