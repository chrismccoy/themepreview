/**
 * The row and pill markup, rendered the same way on the server and in the browser.
 */

/**
 * The five characters EJS escapes, and their entities.
 */
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "'": "&#39;" };

/**
 * Escapes a value for HTML.
 */
export function escapeHtml(value) {
  return value === undefined || value === null
    ? ""
    : String(value).replace(/[&<>'"]/g, (c) => ESCAPES[c]);
}

/**
 * Renders one list row.
 */
export function themeItem({ theme, number, isActive }) {
  const e = escapeHtml;
  return (
    `<li id="theme-${e(theme.id)}" role="option" aria-selected="${isActive ? "true" : "false"}"` +
    ` data-id="${e(theme.id)}" tabindex="-1"` +
    ` class="flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition ${
      isActive
        ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
        : "border-zinc-200 bg-white hover:bg-zinc-50"
    }">` +
    `<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
      isActive ? "border-white bg-white text-zinc-900" : "border-zinc-300 bg-white text-transparent"
    }">` +
    '<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />' +
    "</svg></span>" +
    '<span class="min-w-0 flex-1">' +
    `<span class="block truncate font-sans text-sm font-semibold ${
      isActive ? "text-white" : "text-zinc-900"
    }">${e(String(number).padStart(2, "0"))} — ${e(theme.name)}</span>` +
    `<span class="block truncate font-mono text-[11px] ${
      isActive ? "text-zinc-400" : "text-zinc-500"
    }">${e(theme.category)}</span>` +
    "</span>" +
    `<span class="font-mono text-[11px] ${
      isActive ? "text-white/60" : "text-zinc-400"
    }" aria-hidden="true">${isActive ? "●" : "○"}</span>` +
    "</li>"
  );
}

/**
 * Renders one category pill.
 */
export function categoryPill({ name, count, isActive }) {
  const e = escapeHtml;
  return (
    `<button type="button" data-cat="${e(name)}" aria-pressed="${isActive ? "true" : "false"}"` +
    ` class="shrink-0 rounded-full border px-3 py-1.5 font-mono text-xs transition ${
      isActive
        ? "border-zinc-900 bg-zinc-900 text-white"
        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
    }">${e(name)} <span class="${
      isActive ? "text-white/60" : "text-zinc-400"
    }">· ${e(count)}</span></button>`
  );
}
