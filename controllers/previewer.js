/**
 * Renders the previewer page.
 */

import { createStore, selectActive, selectCategories } from "../shared/store.js";
import { buildCounters, buildRowsHtml } from "../shared/view-model.js";
import { safeJson } from "../utils/safe-json.js";

/**
 * Builds the handler for `GET /`.
 */
export function createPreviewerHandler({ config, cache, templates }) {
  return async function renderPreviewer(req, res) {
    let hit;
    try {
      hit = await cache.get();
    } catch {
      res.status(503).set("Cache-Control", "no-store");
      return res.render("error", { nonce: res.locals.nonce });
    }

    const { themes } = hit.value;
    const state = createStore({ themes }).getState();

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.render("index", {
      nonce: res.locals.nonce,
      links: config.navLinks,
      total: themes.length,
      active: selectActive(state),
      counters: buildCounters(state),
      fallbackImage: config.fallbackImage,
      rowsHtml: buildRowsHtml(state, templates.render.themeItem),
      pillsHtml: selectCategories(state).map(templates.render.categoryPill).join(""),
      stateJson: safeJson(themes),
      templatesJs: templates.clientJs,
    });
  };
}
