/**
 * tests for event setup, over the real server-rendered page.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../lib/app.js";
import { createCache } from "../lib/cache.js";
import { loadConfig } from "../config/index.js";
import { startPreviewer } from "../public/js/previewer.js";

const CONFIG = loadConfig({ WP_API_BASE: "https://wp.example.com/wp-json/themeshowcase/v1" });

const THEMES = [
  { id: "aurora", name: "Aurora", category: "Blog", image: "https://wp.example.com/a.png", url: "https://aurora.test" },
  { id: "basalt", name: "Basalt", category: "Portfolio", image: "https://wp.example.com/b.png", url: "https://basalt.test" },
  { id: "cinder", name: "Cinder", category: "Blog", image: "", url: "" },
];

const activeId = () => document.querySelector('[aria-selected="true"]')?.dataset.id ?? null;
const rowIds = () => [...document.querySelectorAll("#theme-list [role=option]")].map((el) => el.dataset.id);
const el = (id) => document.getElementById(id);

function key(target, k) {
  target.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

beforeEach(async () => {
  const cache = createCache({ loader: async () => ({ value: { themes: THEMES } }), now: () => 1 });
  const app = createApp({ config: CONFIG, cache });
  const res = await request(app).get("/");
  document.documentElement.innerHTML = res.text.replace(/^[\s\S]*?<html[^>]*>/, "").replace(/<\/html>\s*$/, "");
  const inline = [...document.querySelectorAll("script")].find((s) => !s.type && s.textContent.includes("__TPL__"));
  new Function(inline.textContent).call(window);
  startPreviewer({ root: document, win: window, fallbackImage: CONFIG.fallbackImage });
});

describe("pointer interaction", () => {
  it("selects the clicked row", () => {
    el("theme-basalt").click();
    expect(activeId()).toBe("basalt");
  });

  it("filters when the search box is typed into", () => {
    el("search").value = "cin";
    el("search").dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(rowIds()).toEqual(["cinder"]);
  });

  it("filters when a category pill is clicked", () => {
    document.querySelector('[data-cat="Portfolio"]').click();
    expect(rowIds()).toEqual(["basalt"]);
  });

  it("advances with the Next button", () => {
    el("next-btn").click();
    expect(activeId()).toBe("basalt");
  });

  it("goes back with the Prev button", () => {
    el("next-btn").click();
    el("prev-btn").click();
    expect(activeId()).toBe("aurora");
  });
});

describe("keyboard interaction", () => {
  it("moves down the list with ArrowDown", () => {
    key(el("theme-list"), "ArrowDown");
    expect(activeId()).toBe("basalt");
  });

  it("moves back up with ArrowUp", () => {
    key(el("theme-list"), "ArrowDown");
    key(el("theme-list"), "ArrowUp");
    expect(activeId()).toBe("aurora");
  });

  it("moves through the list from the search box too", () => {
    key(el("search"), "ArrowDown");
    expect(activeId()).toBe("basalt");
  });

  it("leaves arrow keys alone outside the previewer", () => {
    key(document.body, "ArrowDown");
    expect(activeId()).toBe("aurora");
  });

  it("prevents the page from scrolling when it handles an arrow key", () => {
    const event = new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    el("theme-list").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens the active demo in a new tab on Enter", () => {
    const open = vi.fn();
    window.open = open;
    key(el("theme-list"), "Enter");
    expect(open).toHaveBeenCalledWith("https://aurora.test", "_blank", "noopener,noreferrer");
  });

  it("does nothing on Enter when the active theme has no demo address", () => {
    const open = vi.fn();
    window.open = open;
    el("theme-cinder").click();
    key(el("theme-list"), "Enter");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("hydration", () => {
  const boot = () => startPreviewer({ root: document, win: window, fallbackImage: CONFIG.fallbackImage });

  it("hydrates an empty list rather than throwing when the state blob is unparseable", () => {
    document.getElementById("__THEMES__").textContent = "{not json";
    let store;
    expect(() => { store = boot(); }).not.toThrow();
    expect(store.getState().themes).toEqual([]);
  });

  it("hydrates an empty list when the state blob is valid JSON but not an array", () => {
    document.getElementById("__THEMES__").textContent = '{"themes":[]}';
    expect(boot().getState().themes).toEqual([]);
  });

  it("hydrates an empty list when the state blob is absent entirely", () => {
    document.getElementById("__THEMES__").remove();
    expect(boot().getState().themes).toEqual([]);
  });
});

describe("image failure", () => {
  it("swaps to the fallback image when the screenshot fails to load", () => {
    const img = el("preview-image");
    img.dispatchEvent(new window.Event("error"));
    expect(img.getAttribute("src")).toBe(CONFIG.fallbackImage);
  });

  it("does not loop when the fallback image itself fails", () => {
    const img = el("preview-image");
    img.dispatchEvent(new window.Event("error"));
    img.dispatchEvent(new window.Event("error"));
    expect(img.getAttribute("src")).toBe(CONFIG.fallbackImage);
  });
});
