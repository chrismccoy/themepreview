/**
 * Tests for the screenshot proxy route.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../lib/app.js";
import { createCache } from "../lib/cache.js";
import { createImageSource } from "../services/image-source.js";
import { loadConfig } from "../config/index.js";

const CONFIG = loadConfig({ WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1" });

const THEMES = [
  { id: "aurora", name: "Aurora", category: "Blog", image: "https://wp.example.com/a.png", url: "https://aurora.test" },
  { id: "basalt", name: "Basalt", category: "Portfolio", image: "", url: "" },
];

const PNG = new Uint8Array([137, 80, 78, 71]);

function appWith(fetchImpl, { themes = THEMES } = {}) {
  const cache = createCache({
    loader: async () => ({ value: { themes, total: themes.length, pages: 1 }, ttlMs: 300_000 }),
    now: () => 1000,
  });
  const imageSource = createImageSource({
    imageHosts: CONFIG.imageHosts,
    timeoutMs: 50,
    maxBytes: CONFIG.maxImageBytes,
    fetchImpl,
  });
  return createApp({ config: CONFIG, cache, imageSource });
}

const png = () => new Response(PNG, { status: 200, headers: { "Content-Type": "image/png" } });

describe("GET /media/theme/:id", () => {
  it("streams the upstream screenshot", async () => {
    const app = appWith(async () => png());
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.body.length).toBe(4);
  });

  it("fetches the upstream URL the theme carries", async () => {
    let seen;
    const app = appWith(async (url) => {
      seen = url;
      return png();
    });
    await request(app).get("/media/theme/aurora").expect(200);
    expect(seen).toBe("https://wp.example.com/a.png");
  });

  it("names the WordPress host in no response header", async () => {
    const app = appWith(async () => png());
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(JSON.stringify(res.headers)).not.toContain("wp.example.com");
  });

  it("caches a hit for five minutes", async () => {
    const app = appWith(async () => png());
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
  });

  it("relays the upstream validators", async () => {
    const app = appWith(
      async () =>
        new Response(PNG, {
          status: 200,
          headers: { "Content-Type": "image/png", ETag: '"xyz"', "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT" },
        })
    );
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(res.headers.etag).toBe('"xyz"');
    expect(res.headers["last-modified"]).toBe("Wed, 01 Jan 2025 00:00:00 GMT");
  });

  it("relays a 304 with no body", async () => {
    let seen;
    const app = appWith(async (url, options) => {
      seen = options.headers;
      return new Response(null, { status: 304, headers: { ETag: '"xyz"' } });
    });
    const res = await request(app).get("/media/theme/aurora").set("If-None-Match", '"xyz"').expect(304);
    expect(seen["If-None-Match"]).toBe('"xyz"');
    expect(res.body).toEqual({});
  });

  it("answers 404 for a theme it does not know", async () => {
    const app = appWith(async () => png());
    await request(app).get("/media/theme/nope").expect(404);
  });

  it("serves the placeholder when the theme has no screenshot", async () => {
    const app = appWith(async () => png());
    const res = await request(app).get("/media/theme/basalt").expect(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("serves the placeholder when the upstream fetch fails", async () => {
    const app = appWith(async () => new Response("", { status: 500 }));
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("serves the placeholder when the upstream returns a type it will not pass through", async () => {
    const app = appWith(
      async () => new Response("<svg/>", { status: 200, headers: { "Content-Type": "image/svg+xml" } })
    );
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("serves the placeholder when the theme list cannot be loaded", async () => {
    const cache = createCache({
      loader: async () => {
        throw new Error("wp down");
      },
      now: () => 1000,
    });
    const imageSource = createImageSource({
      imageHosts: CONFIG.imageHosts,
      timeoutMs: 50,
      maxBytes: CONFIG.maxImageBytes,
      fetchImpl: async () => png(),
    });
    const app = createApp({ config: CONFIG, cache, imageSource });
    const res = await request(app).get("/media/theme/aurora").expect(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });
});
