/**
 * Tests for environment parsing and validation.
 */

import { describe, it, expect } from "vitest";
import { loadConfig } from "../config/index.js";

describe("loadConfig", () => {
  it("throws when WP_API_BASE is missing", () => {
    expect(() => loadConfig({})).toThrow(/WP_API_BASE/);
  });

  it("strips a trailing slash from WP_API_BASE", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1/" });
    expect(cfg.wpApiBase).toBe("https://wp.example.com/wp-json/themeshowcase/v1");
  });

  it("defaults port to 3000 and timeout to 5000", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x" });
    expect(cfg.port).toBe(3000);
    expect(cfg.wpTimeoutMs).toBe(5000);
  });

  it("reads numeric overrides from the environment", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x", PORT: "8080", WP_TIMEOUT_MS: "250" });
    expect(cfg.port).toBe(8080);
    expect(cfg.wpTimeoutMs).toBe(250);
  });

  it("rejects a non-numeric PORT rather than falling back silently", () => {
    expect(() => loadConfig({ WP_API_BASE: "https://wp.example.com/x", PORT: "abc" })).toThrow(/PORT/);
  });

  it("leaves cacheTtlMs null when unset so the response Cache-Control decides", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x" });
    expect(cfg.cacheTtlMs).toBeNull();
  });

  it("has no navigation links by default", () => {
    expect(loadConfig({ WP_API_BASE: "https://wp.example.com/x" }).navLinks).toEqual([]);
  });

  it("parses navigation links from a label|url comma separated list", () => {
    const cfg = loadConfig({
      WP_API_BASE: "https://wp.example.com/x",
      NAV_LINKS: "Github|https://github.com/me, Directory|https://dir.test",
    });
    expect(cfg.navLinks).toEqual([
      { label: "Github", href: "https://github.com/me" },
      { label: "Directory", href: "https://dir.test" },
    ]);
  });

  it("skips malformed navigation link entries", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x", NAV_LINKS: "Broken, Ok|https://ok.test" });
    expect(cfg.navLinks).toEqual([{ label: "Ok", href: "https://ok.test" }]);
  });

  it("adds explicitly configured image hosts, for media served off a CDN", () => {
    const cfg = loadConfig({
      WP_API_BASE: "https://wp.example.com/x",
      IMAGE_HOSTS: "https://cdn.test, https://media.test/a/b",
    });
    expect(cfg.imageHosts).toContain("https://cdn.test");
    expect(cfg.imageHosts).toContain("https://media.test");
  });

  it("ignores image hosts that are not absolute URLs", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x", IMAGE_HOSTS: "nonsense, ," });
    expect(cfg.imageHosts).toEqual(["https://wp.example.com"]);
  });

  it("derives the webfont origins from the stylesheet it will request", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x" });
    expect(cfg.fonts.stylesheet).toContain("fonts.googleapis.com");
    expect(cfg.fonts.styleHosts).toEqual(["https://fonts.googleapis.com"]);
    expect(cfg.fonts.fontHosts).toEqual(["https://fonts.gstatic.com"]);
  });

  it("drops both webfont origins when the stylesheet is turned off", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x", FONT_STYLESHEET: "" });
    expect(cfg.fonts).toEqual({ stylesheet: null, styleHosts: [], fontHosts: [] });
  });

  it("defaults the cache ttl bounds to sixty and nine hundred seconds", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x" });
    expect(cfg.cacheMinTtlMs).toBe(60_000);
    expect(cfg.cacheMaxTtlMs).toBe(900_000);
  });

  it("reads the cache ttl bounds from the environment", () => {
    const cfg = loadConfig({
      WP_API_BASE: "https://wp.example.com/x",
      CACHE_MIN_TTL_MS: "1000",
      CACHE_MAX_TTL_MS: "2000",
    });
    expect(cfg.cacheMinTtlMs).toBe(1000);
    expect(cfg.cacheMaxTtlMs).toBe(2000);
  });

  it("serves its own fallback image rather than a third-party one by default", () => {
    expect(loadConfig({ WP_API_BASE: "https://wp.example.com/x" }).fallbackImage).toBe(
      "/img/placeholder.svg"
    );
  });

  it("exposes the image host of the fallback image for the content security policy", () => {
    const cfg = loadConfig({ WP_API_BASE: "https://wp.example.com/x", FALLBACK_IMAGE: "https://cdn.test/a.png" });
    expect(cfg.fallbackImage).toBe("https://cdn.test/a.png");
    expect(cfg.imageHosts).toContain("https://cdn.test");
    expect(cfg.imageHosts).toContain("https://wp.example.com");
  });
});
