/**
 * Tests for the guarded screenshot fetcher.
 */

import { describe, it, expect } from "vitest";
import { createImageSource, ImageSourceError } from "../services/image-source.js";

const HOSTS = ["https://wp.example.com"];

function sourceFor(fetchImpl, { maxBytes = 1000 } = {}) {
  return createImageSource({ imageHosts: HOSTS, timeoutMs: 50, maxBytes, fetchImpl });
}

function imageResponse(bytes, { status = 200, type = "image/png", headers = {} } = {}) {
  return new Response(bytes, { status, headers: { "Content-Type": type, ...headers } });
}

const PNG = new Uint8Array([137, 80, 78, 71]);

async function drain(stream) {
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

describe("createImageSource.fetchImage", () => {
  it("returns the body and content type for an allowed origin", async () => {
    const source = sourceFor(async () => imageResponse(PNG));
    const result = await source.fetchImage("https://wp.example.com/a.png");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("image/png");
    expect(await drain(result.body)).toBe(4);
  });

  it("refuses an origin that is not on the allowlist", async () => {
    const source = sourceFor(async () => imageResponse(PNG));
    await expect(source.fetchImage("https://evil.test/a.png")).rejects.toMatchObject({
      name: "ImageSourceError",
      reason: "origin",
    });
  });

  it("refuses a value that is not a URL", async () => {
    const source = sourceFor(async () => imageResponse(PNG));
    await expect(source.fetchImage("not-a-url")).rejects.toMatchObject({ reason: "invalid-url" });
  });

  it("refuses SVG, which would be a same-origin document rather than a picture", async () => {
    const source = sourceFor(async () => imageResponse("<svg/>", { type: "image/svg+xml" }));
    await expect(source.fetchImage("https://wp.example.com/a.svg")).rejects.toMatchObject({
      reason: "content-type",
    });
  });

  it("ignores parameters when matching the content type", async () => {
    const source = sourceFor(async () => imageResponse(PNG, { type: "image/png; charset=binary" }));
    const result = await source.fetchImage("https://wp.example.com/a.png");
    expect(result.contentType).toBe("image/png");
  });

  it("refuses a non-2xx upstream response", async () => {
    const source = sourceFor(async () => imageResponse("", { status: 404 }));
    await expect(source.fetchImage("https://wp.example.com/missing.png")).rejects.toMatchObject({
      reason: "status",
    });
  });

  it("refuses a body that declares itself oversize", async () => {
    const source = sourceFor(
      async () => imageResponse(PNG, { headers: { "Content-Length": "5000" } }),
      { maxBytes: 100 }
    );
    await expect(source.fetchImage("https://wp.example.com/big.png")).rejects.toMatchObject({
      reason: "too-large",
    });
  });

  it("aborts a body that runs past the cap without declaring it", async () => {
    const source = sourceFor(async () => imageResponse(new Uint8Array(500)), { maxBytes: 100 });
    const result = await source.fetchImage("https://wp.example.com/big.png");
    await expect(drain(result.body)).rejects.toMatchObject({ reason: "too-large" });
  });

  it("passes conditional headers upstream and relays a 304", async () => {
    let seen;
    const source = sourceFor(async (url, options) => {
      seen = options.headers;
      return new Response(null, { status: 304, headers: { ETag: '"abc"' } });
    });
    const result = await source.fetchImage("https://wp.example.com/a.png", {
      ifNoneMatch: '"abc"',
      ifModifiedSince: "Wed, 01 Jan 2025 00:00:00 GMT",
    });
    expect(seen["If-None-Match"]).toBe('"abc"');
    expect(seen["If-Modified-Since"]).toBe("Wed, 01 Jan 2025 00:00:00 GMT");
    expect(result.status).toBe(304);
    expect(result.body).toBe(null);
    expect(result.etag).toBe('"abc"');
  });

  it("relays the upstream validators on a hit", async () => {
    const source = sourceFor(async () =>
      imageResponse(PNG, { headers: { ETag: '"xyz"', "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT" } })
    );
    const result = await source.fetchImage("https://wp.example.com/a.png");
    expect(result.etag).toBe('"xyz"');
    expect(result.lastModified).toBe("Wed, 01 Jan 2025 00:00:00 GMT");
  });

  it("sends an abort signal so a slow upstream cannot hang the request", async () => {
    let seen;
    const source = sourceFor(async (url, options) => {
      seen = options.signal;
      return imageResponse(PNG);
    });
    await source.fetchImage("https://wp.example.com/a.png");
    expect(seen).toBeInstanceOf(AbortSignal);
  });

  it("exports the error type it rejects with", () => {
    expect(new ImageSourceError("origin", "nope")).toBeInstanceOf(Error);
  });
});
