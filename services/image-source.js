/**
 * Fetches theme screenshots from WordPress
 */

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/**
 * An upstream screenshot that cannot be served
 */
export class ImageSourceError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = "ImageSourceError";
    this.reason = reason;
  }
}

/**
 * Builds the screenshot fetcher.
 */
export function createImageSource({ imageHosts, timeoutMs, maxBytes, fetchImpl = fetch }) {
  const allowed = new Set(imageHosts);

  function assertAllowed(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new ImageSourceError("invalid-url", `Not an absolute URL: "${url}"`);
    }
    if (!allowed.has(parsed.origin)) {
      throw new ImageSourceError("origin", `Origin is not allowed: ${parsed.origin}`);
    }
  }

  function capped(body) {
    let seen = 0;
    return body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > maxBytes) {
            throw new ImageSourceError("too-large", `Screenshot exceeded ${maxBytes} bytes`);
          }
          controller.enqueue(chunk);
        },
      })
    );
  }

  /**
   * Fetches one screenshot
   */
  async function fetchImage(url, conditional = {}) {
    assertAllowed(url);

    const headers = { Accept: "image/*" };
    if (conditional.ifNoneMatch) headers["If-None-Match"] = conditional.ifNoneMatch;
    if (conditional.ifModifiedSince) headers["If-Modified-Since"] = conditional.ifModifiedSince;

    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers,
    });

    const etag = response.headers.get("ETag");
    const lastModified = response.headers.get("Last-Modified");

    if (response.status === 304) {
      return { status: 304, contentType: null, etag, lastModified, body: null };
    }

    if (!response.ok) {
      throw new ImageSourceError("status", `Upstream responded ${response.status}`);
    }

    const contentType = (response.headers.get("Content-Type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_TYPES.has(contentType)) {
      throw new ImageSourceError(
        "content-type",
        `Refusing content type "${contentType || "(none)"}"`
      );
    }

    const declared = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ImageSourceError("too-large", `Screenshot declares ${declared} bytes`);
    }

    return { status: 200, contentType, etag, lastModified, body: capped(response.body) };
  }

  return { fetchImage };
}
