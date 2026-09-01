/**
 * Tests for the two routes
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../lib/app.js";
import { createCache } from "../lib/cache.js";
import { loadConfig } from "../config/index.js";

const CONFIG = loadConfig({ WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1" });

const THEMES = [
  { id: "aurora", name: "Aurora", category: "Blog", image: "https://wp.example.com/a.png", url: "https://aurora.test" },
  { id: "basalt", name: "Basalt", category: "Portfolio", image: "", url: "" },
];

function appWith(loader, { now = () => 1000 } = {}) {
  const cache = createCache({ loader, now });
  return { app: createApp({ config: CONFIG, cache }), cache };
}

const region = (id) => (res) =>
  new RegExp(`id="${id}"[\\s\\S]*?<!-- /${id} -->`).exec(res.text)[0];
const listOf = region("theme-list");
const pillsOf = region("pill-filters");

const ok = async () => ({ value: { themes: THEMES, total: 2, pages: 1 }, ttlMs: 300_000 });

describe("GET /", () => {
  it("renders every theme row server-side", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/").expect(200);
    expect(res.text).toContain("Aurora");
    expect(res.text).toContain("Basalt");
    expect(listOf(res).match(/role="option"/g)).toHaveLength(2);
  });

  it("marks the first theme as the active option", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    expect(res.text).toMatch(/id="theme-aurora"[^>]*aria-selected="true"/);
  });

  it("renders the first theme into the preview frame", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    expect(res.text).toContain('src="https://wp.example.com/a.png"');
    expect(res.text).toContain('alt="Aurora"');
  });

  it("renders a category pill per category plus All", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    expect(pillsOf(res).match(/data-cat="/g)).toHaveLength(3);
  });

  it("inlines the theme data for the client to hydrate from", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    const match = /<script id="__THEMES__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(res.text);
    expect(JSON.parse(match[1].replaceAll("\\u003c", "<").replaceAll("\\u003e", ">").replaceAll("\\u0026", "&"))).toEqual(THEMES);
  });

  it("never leaks the WordPress origin into the page", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    expect(res.text).not.toContain("wp-json");
  });

  it("escapes markup in a theme name instead of emitting it", async () => {
    const evil = [{ id: "x", name: "</script><img src=x onerror=alert(1)>", category: "Blog", image: "", url: "" }];
    const { app } = appWith(async () => ({ value: { themes: evil, total: 1, pages: 1 }, ttlMs: 1000 }));
    const res = await request(app).get("/");
    expect(res.text).not.toContain("<img src=x");
    expect(res.text).toContain("&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(res.text).not.toMatch(/<script id="__THEMES__"[^>]*>[^<]*<\/script><img/);
  });

  it("ships the compiled row template to the browser", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    expect(res.text).toContain("__TPL__");
  });

  it("renders an empty state when WordPress returns no themes", async () => {
    const { app } = appWith(async () => ({ value: { themes: [], total: 0, pages: 0 }, ttlMs: 1000 }));
    const res = await request(app).get("/").expect(200);
    expect(listOf(res)).toContain("No themes found");
  });

  it("answers 503 when the cache is cold and WordPress is unreachable", async () => {
    const { app } = appWith(async () => { throw new Error("wp down"); });
    const res = await request(app).get("/").expect(503);
    expect(res.text).toMatch(/unavailable/i);
  });

  it("serves the last good render while WordPress is down", async () => {
    let calls = 0;
    let t = 1000;
    const { app } = appWith(
      async () => {
        calls += 1;
        if (calls === 1) return { value: { themes: THEMES, total: 2, pages: 1 }, ttlMs: 100 };
        throw new Error("wp down");
      },
      { now: () => t }
    );
    await request(app).get("/").expect(200);
    t += 101;
    const res = await request(app).get("/").expect(200);
    expect(res.text).toContain("Aurora");
  });

  it("sets a content security policy carrying a per-request nonce", async () => {
    const { app } = appWith(ok);
    const first = await request(app).get("/");
    const second = await request(app).get("/");
    const nonceOf = (res) => /'nonce-([^']+)'/.exec(res.headers["content-security-policy"])[1];
    expect(nonceOf(first)).not.toBe(nonceOf(second));
    expect(first.text).toContain(`nonce="${nonceOf(first)}"`);
  });
});

describe("content security policy", () => {
  const cspOf = (res) => res.headers["content-security-policy"];

  it("allows every external origin the rendered page requests", async () => {
    const { app } = appWith(ok);
    const res = await request(app).get("/");
    const origins = [...res.text.matchAll(/<link[^>]*\bhref="(https?:\/\/[^"]+)"/g)].map(
      (m) => new URL(m[1]).origin
    );
    expect(origins.length).toBeGreaterThan(0);
    for (const o of new Set(origins)) expect(cspOf(res)).toContain(o);
  });

  it("allows images from every configured image host", async () => {
    const config = loadConfig({
      WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1",
      IMAGE_HOSTS: "https://cdn.test",
    });
    const app = createApp({ config, cache: createCache({ loader: ok, now: () => 1000 }) });
    const res = await request(app).get("/");
    for (const host of config.imageHosts) expect(cspOf(res)).toContain(host);
    expect(cspOf(res)).toContain("https://cdn.test");
  });

  it("names no webfont origin, and requests none, when the stylesheet is turned off", async () => {
    const config = loadConfig({
      WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1",
      FONT_STYLESHEET: "",
    });
    const app = createApp({ config, cache: createCache({ loader: ok, now: () => 1000 }) });
    const res = await request(app).get("/");
    expect(res.text).not.toContain("fonts.googleapis.com");
    expect(cspOf(res)).not.toContain("fonts.googleapis.com");
    expect(cspOf(res)).not.toContain("fonts.gstatic.com");
    expect(res.text).toContain('href="/css/app.css"');
  });
});

describe("static modules", () => {
  it("serves the browser entry point and the modules it shares with the server", async () => {
    const { app } = appWith(ok);
    await request(app).get("/js/main.js").expect(200);
    const store = await request(app).get("/shared/store.js").expect(200);
    expect(store.text).toContain("export function createStore");
    await request(app).get("/shared/view-model.js").expect(200);
  });

  it("resolves every import the browser follows from the entry point", async () => {
    const { app } = appWith(ok);
    const seen = new Set();

    const visit = async (url) => {
      if (seen.has(url)) return;
      seen.add(url);
      const res = await request(app).get(url).expect(200);
      const specs = [...res.text.matchAll(/\bfrom\s*["']([^"']+)["']/g)]
        .map((m) => m[1])
        .filter((spec) => spec.startsWith(".") || spec.startsWith("/"));
      for (const spec of specs) {
        await visit(new URL(spec, `http://x${url}`).pathname);
      }
    };

    await visit("/js/main.js");
    expect([...seen].sort()).toEqual([
      "/js/main.js",
      "/js/previewer.js",
      "/js/render.js",
      "/shared/store.js",
      "/shared/view-model.js",
    ]);
  });
});

describe("GET /health", () => {
  it("reports a healthy cache", async () => {
    const { app } = appWith(ok);
    await request(app).get("/");
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", hasValue: true, lastError: null });
  });

  it("reports degraded once a refresh has failed", async () => {
    let calls = 0;
    let t = 1000;
    const { app } = appWith(
      async () => {
        calls += 1;
        if (calls === 1) return { value: { themes: THEMES, total: 2, pages: 1 }, ttlMs: 100 };
        throw new Error("wp down");
      },
      { now: () => t }
    );
    await request(app).get("/");
    t += 101;
    await request(app).get("/");
    const res = await request(app).get("/health").expect(200);
    expect(res.body.status).toBe("degraded");
  });
});
