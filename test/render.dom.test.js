/**
 * Tests that the browser renders
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../lib/app.js";
import { createCache } from "../lib/cache.js";
import { loadConfig } from "../config/index.js";
import { createStore } from "../shared/store.js";
import { createRenderer } from "../public/js/render.js";

const CONFIG = loadConfig({ WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1" });

const THEMES = [
  { id: "aurora", name: "Aurora", category: "Blog", image: "https://wp.example.com/a.png", url: "https://aurora.test" },
  { id: "basalt", name: "Basalt", category: "Portfolio", image: "https://wp.example.com/b.png", url: "https://basalt.test" },
  { id: "cinder", name: "Cinder", category: "Blog", image: "", url: "" },
];

let store;
let render;

beforeEach(async () => {
  const cache = createCache({ loader: async () => ({ value: { themes: THEMES }, ttlMs: 1000 }), now: () => 1 });
  const app = createApp({ config: CONFIG, cache });
  const res = await request(app).get("/");

  document.documentElement.innerHTML = res.text.replace(/^[\s\S]*?<html[^>]*>/, "").replace(/<\/html>\s*$/, "");
  const inline = [...document.querySelectorAll("script")].find((el) => !el.type && el.textContent.includes("__TPL__"));
  new Function(inline.textContent).call(window);

  store = createStore({ themes: JSON.parse(document.getElementById("__THEMES__").textContent) });
  render = createRenderer({ root: document, templates: window.__TPL__, fallbackImage: CONFIG.fallbackImage });
  render(store.getState(), null);
});

const rowIds = () => [...document.querySelectorAll("#theme-list [role=option]")].map((el) => el.dataset.id);

describe("the browser render matches what the server rendered", () => {
  it("starts from the server-rendered rows", () => {
    expect(rowIds()).toEqual(["aurora", "basalt", "cinder"]);
  });

  it("leaves the active row marked after a no-op render", () => {
    expect(document.querySelector('[aria-selected="true"]').dataset.id).toBe("aurora");
  });
});

describe("filtering", () => {
  it("shows only the matching rows for a query", () => {
    const prev = store.getState();
    store.dispatch({ type: "SET_QUERY", query: "cin" });
    render(store.getState(), prev);
    expect(rowIds()).toEqual(["cinder"]);
  });

  it("keeps the original numbering when rows are filtered out", () => {
    const prev = store.getState();
    store.dispatch({ type: "SET_QUERY", query: "cin" });
    render(store.getState(), prev);
    expect(document.querySelector("#theme-list [role=option]").textContent).toContain("03");
  });

  it("shows the empty state when nothing matches", () => {
    const prev = store.getState();
    store.dispatch({ type: "SET_QUERY", query: "zzz" });
    render(store.getState(), prev);
    expect(rowIds()).toEqual([]);
    expect(document.getElementById("theme-list").textContent).toContain("No themes found");
  });

  it("updates the filter summary line", () => {
    const prev = store.getState();
    store.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    render(store.getState(), prev);
    expect(document.getElementById("filter-meta").textContent).toBe("Showing 2 of 3 • Blog");
  });

  it("marks the chosen category pill as pressed", () => {
    const prev = store.getState();
    store.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    render(store.getState(), prev);
    expect(document.querySelector('[data-cat="Blog"]').getAttribute("aria-pressed")).toBe("true");
  });
});

describe("selection", () => {
  it("swaps the preview image, address, and label once the transition completes", () => {
    vi.useFakeTimers();
    const prev = store.getState();
    store.dispatch({ type: "SELECT", id: "basalt" });
    render(store.getState(), prev);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(document.getElementById("preview-image").getAttribute("src")).toBe("https://wp.example.com/b.png");
    expect(document.getElementById("browser-url").textContent).toBe("https://basalt.test");
    expect(document.getElementById("preview-label").textContent).toBe("02 — Basalt");
  });

  it("falls back to the placeholder image when a theme has none", () => {
    vi.useFakeTimers();
    const prev = store.getState();
    store.dispatch({ type: "SELECT", id: "cinder" });
    render(store.getState(), prev);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(document.getElementById("preview-image").getAttribute("src")).toBe(CONFIG.fallbackImage);
  });

  it("crossfades over exactly the duration the markup declares", () => {
    const image = document.getElementById("preview-image");
    const declared = Number(image.dataset.transitionMs);
    expect(declared).toBeGreaterThan(0);

    vi.useFakeTimers();
    const prev = store.getState();
    store.dispatch({ type: "SELECT", id: "basalt" });
    render(store.getState(), prev);

    vi.advanceTimersByTime(declared - 1);
    expect(image.getAttribute("src")).toBe("https://wp.example.com/a.png");
    vi.advanceTimersByTime(1);
    expect(image.getAttribute("src")).toBe("https://wp.example.com/b.png");
    vi.useRealTimers();
  });

  it("points aria-activedescendant at the active row", () => {
    const prev = store.getState();
    store.dispatch({ type: "SELECT", id: "basalt" });
    render(store.getState(), prev);
    expect(document.getElementById("theme-list").getAttribute("aria-activedescendant")).toBe("theme-basalt");
  });

  it("disables Prev on the first theme and Next on the last", () => {
    expect(document.getElementById("prev-btn").disabled).toBe(true);
    const prev = store.getState();
    store.dispatch({ type: "SELECT", id: "cinder" });
    render(store.getState(), prev);
    expect(document.getElementById("next-btn").disabled).toBe(true);
    expect(document.getElementById("prev-btn").disabled).toBe(false);
  });

  it("updates the progress counters", () => {
    const prev = store.getState();
    store.dispatch({ type: "SELECT", id: "basalt" });
    render(store.getState(), prev);
    expect(document.getElementById("progress").textContent).toBe("2 of 3");
    expect(document.getElementById("browser-count").textContent).toBe("02 / 3");
  });

  it("escapes a hostile theme name rather than executing it", () => {
    const evil = { id: "evil", name: "<img src=x onerror=window.__pwned=1>", category: "Blog", image: "", url: "" };
    const s = createStore({ themes: [...THEMES, evil] });
    const prev = s.getState();
    s.dispatch({ type: "SET_QUERY", query: "img" });
    render(s.getState(), prev);
    expect(document.querySelectorAll("#theme-list img")).toHaveLength(0);
    expect(window.__pwned).toBeUndefined();
  });
});
