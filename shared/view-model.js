/**
 * Gets the text shown in the counters and the state of the navigation buttons.
 */

import {
  selectFiltered,
  selectActive,
  selectActiveIndex,
  selectNumberOf,
  selectRows,
} from "./store.js";

/**
 * Markup shown in place of the list when nothing matches the filter.
 */
export const EMPTY_ROWS_HTML =
  '<li class="py-10 text-center font-mono text-xs text-zinc-400">No themes found</li>';

/**
 * Pads a number to two digits, matching the design's `01`, `02` style.
 */
const pad = (n) => String(n).padStart(2, "0");

/**
 * Builds the counter text and button state for the current state.
 */
export function buildCounters(state) {
  const filtered = selectFiltered(state);
  const active = selectActive(state);
  const index = selectActiveIndex(state);
  const number = active ? selectNumberOf(state, active.id) : 0;

  return {
    progress: active ? `${index + 1} of ${filtered.length}` : "",
    browser: active ? `${pad(index + 1)} / ${filtered.length}` : "",
    meta: `Showing ${filtered.length} of ${state.themes.length} • ${state.category}`,
    label: active ? `${pad(number)} — ${active.name}` : "",
    hasPrev: index > 0,
    hasNext: index > -1 && index < filtered.length - 1,
  };
}

/**
 * Renders the list rows, or the empty state.
 */
export function buildRowsHtml(state, renderItem) {
  const rows = selectRows(state);
  if (!rows.length) return EMPTY_ROWS_HTML;
  return rows.map(renderItem).join("");
}
