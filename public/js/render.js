import {
  selectFiltered,
  selectActive,
  selectCategories,
  selectRows,
} from "../../shared/store.js";
import { buildCounters, EMPTY_ROWS_HTML } from "../../shared/view-model.js";

/**
 * The five characters EJS escapes, and their entities.
 */
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "'": "&#39;" };

/**
 * Escapes a value for HTML.
 */
export function escapeXML(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/[&<>'"]/g, (c) => ESCAPES[c]);
}

/**
 * Builds a comparable ids for a set of themes.
 */
const idsOf = (themes) => themes.map((t) => t.id).join("|");

/**
 * Creates the renderer.
 */
export function createRenderer({ root, templates, fallbackImage, transitionMs }) {
  const els = {
    list: root.getElementById("theme-list"),
    pills: root.getElementById("pill-filters"),
    meta: root.getElementById("filter-meta"),
    progress: root.getElementById("progress"),
    navCount: root.getElementById("nav-count"),
    browserCount: root.getElementById("browser-count"),
    browserUrl: root.getElementById("browser-url"),
    image: root.getElementById("preview-image"),
    label: root.getElementById("preview-label"),
    category: root.getElementById("preview-cat"),
    bar: root.getElementById("loading-bar"),
    prev: root.getElementById("prev-btn"),
    next: root.getElementById("next-btn"),
  };

  /**
   * Half duration of the crossfade, in milliseconds.
   */
  const duration = (() => {
    if (Number.isFinite(transitionMs)) return transitionMs;
    const declared = Number(els.image?.dataset?.transitionMs);
    return Number.isFinite(declared) && declared > 0 ? declared : 180;
  })();

  /**
   * Renders one list row.
   */
  const renderItem = (locals) => templates.themeItem(locals, escapeXML);

  /**
   * Renders one category pill.
   */
  const renderPill = (locals) => templates.categoryPill(locals, escapeXML);

  let transitionTimer = null;

  /**
   * Writes a theme into the preview frame, with no animation.
   */
  function paintPreview(active) {
    els.browserUrl.textContent = active ? active.url : "";
    els.category.textContent = active ? active.category : "";
    els.image.setAttribute("src", active ? active.image || fallbackImage : fallbackImage);
    els.image.setAttribute("alt", active ? active.name : "");
  }

  /**
   * Crossfades to a new theme, running the loading bar as it goes.
   */
  function transitionPreview(active, counters) {
    clearTimeout(transitionTimer);
    els.bar.style.opacity = "1";
    els.bar.style.width = "35%";
    els.image.style.opacity = "0.6";

    transitionTimer = setTimeout(() => {
      paintPreview(active);
      els.label.textContent = counters.label;
      els.image.style.opacity = "1";
      els.bar.style.width = "100%";
      transitionTimer = setTimeout(() => {
        els.bar.style.opacity = "0";
        els.bar.style.width = "0%";
      }, duration);
    }, duration);
  }

  /**
   * Applies a state to the page.
   */
  return function render(state, prev) {
    const filtered = selectFiltered(state);
    const active = selectActive(state);
    const counters = buildCounters(state);

    const listChanged =
      !prev ||
      state.activeId !== prev.activeId ||
      (filtered !== selectFiltered(prev) && idsOf(filtered) !== idsOf(selectFiltered(prev)));

    if (listChanged) {
      els.list.innerHTML = filtered.length
        ? selectRows(state).map(renderItem).join("")
        : EMPTY_ROWS_HTML;

      if (active) {
        els.list.setAttribute("aria-activedescendant", `theme-${active.id}`);
        const row = els.list.querySelector(`[data-id="${CSS.escape(active.id)}"]`);
        if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
      } else {
        els.list.removeAttribute("aria-activedescendant");
      }
    }

    if (!prev || state.category !== prev.category || state.themes !== prev.themes) {
      els.pills.innerHTML = selectCategories(state).map(renderPill).join("");
    }

    els.meta.textContent = counters.meta;
    els.progress.textContent = counters.progress;
    els.browserCount.textContent = counters.browser;
    els.navCount.textContent = `${state.themes.length} themes`;
    els.prev.disabled = !counters.hasPrev;
    els.next.disabled = !counters.hasNext;

    if (!prev) {
      paintPreview(active);
      els.label.textContent = counters.label;
    } else if (state.activeId !== prev.activeId) {
      transitionPreview(active, counters);
    }
  };
}
