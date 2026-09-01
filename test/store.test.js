/**
 * Tests for the state container.
 */

import { describe, it, expect, vi } from "vitest";
import {
  createStore,
  selectFiltered,
  selectRows,
  selectCategories,
  selectActive,
  selectActiveIndex,
  selectNumberOf,
} from "../shared/store.js";
import { buildCounters } from "../shared/view-model.js";

const THEMES = [
  { id: "aurora", name: "Aurora", category: "Blog", image: "", url: "https://aurora.test" },
  { id: "basalt", name: "Basalt", category: "Portfolio", image: "", url: "" },
  { id: "cinder", name: "Cinder", category: "Blog", image: "", url: "" },
];

const store = (overrides = {}) => createStore({ themes: THEMES, ...overrides });

describe("createStore", () => {
  it("selects the first theme when no active id is supplied", () => {
    expect(store().getState().activeId).toBe("aurora");
  });

  it("has a null active id when there are no themes", () => {
    expect(createStore({ themes: [] }).getState().activeId).toBeNull();
  });

  it("notifies subscribers when the state changes", () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    s.dispatch({ type: "SELECT", id: "basalt" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify subscribers when an action changes nothing", () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    s.dispatch({ type: "SELECT", id: "aurora" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores a selection of an unknown id", () => {
    const s = store();
    s.dispatch({ type: "SELECT", id: "nope" });
    expect(s.getState().activeId).toBe("aurora");
  });
});

describe("filtering", () => {
  it("matches the query against the name", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "bas" });
    expect(selectFiltered(s.getState()).map((t) => t.id)).toEqual(["basalt"]);
  });

  it("matches the query against the category, ignoring case", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "BLOG" });
    expect(selectFiltered(s.getState()).map((t) => t.id)).toEqual(["aurora", "cinder"]);
  });

  it("restricts results to the chosen category", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Portfolio" });
    expect(selectFiltered(s.getState()).map((t) => t.id)).toEqual(["basalt"]);
  });

  it("returns every theme under the All category", () => {
    expect(selectFiltered(store().getState())).toHaveLength(3);
  });

  it("returns the same array reference for repeated calls with unchanged inputs", () => {
    const state = store().getState();
    expect(selectFiltered(state)).toBe(selectFiltered(state));
  });

  it("keeps a separate result per state, so interleaved reads do not evict each other", () => {
    const a = store().getState();
    const b = createStore({ themes: THEMES.slice(0, 2) }).getState();
    const first = selectFiltered(a);
    selectFiltered(b);
    expect(selectFiltered(a)).toBe(first);
  });

  it("carries the filter result across a selection change", () => {
    const s = store();
    const before = selectFiltered(s.getState());
    s.dispatch({ type: "NEXT" });
    expect(selectFiltered(s.getState())).toBe(before);
  });

  it("recomputes the filter when the query changes", () => {
    const s = store();
    const before = selectFiltered(s.getState());
    s.dispatch({ type: "SET_QUERY", query: "bas" });
    expect(selectFiltered(s.getState())).not.toBe(before);
  });
});

describe("the active id stays inside the filtered set", () => {
  it("moves to the first match when the query excludes the active theme", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "cinder" });
    expect(s.getState().activeId).toBe("cinder");
  });

  it("becomes null when the query matches nothing", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "zzz" });
    expect(s.getState().activeId).toBeNull();
  });

  it("moves to the first match when the category excludes the active theme", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Portfolio" });
    expect(s.getState().activeId).toBe("basalt");
  });

  it("keeps the active theme when it survives the filter", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    expect(s.getState().activeId).toBe("aurora");
  });

  it("restores a selection when the query is cleared", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "zzz" });
    s.dispatch({ type: "SET_QUERY", query: "" });
    expect(s.getState().activeId).toBe("aurora");
  });

  it("refuses to select a theme hidden by the current filter", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Portfolio" });
    s.dispatch({ type: "SELECT", id: "aurora" });
    expect(s.getState().activeId).toBe("basalt");
  });
});

describe("NEXT and PREV", () => {
  it("advances to the following theme", () => {
    const s = store();
    s.dispatch({ type: "NEXT" });
    expect(s.getState().activeId).toBe("basalt");
  });

  it("stops at the end of the list", () => {
    const s = store();
    s.dispatch({ type: "SELECT", id: "cinder" });
    s.dispatch({ type: "NEXT" });
    expect(s.getState().activeId).toBe("cinder");
  });

  it("stops at the start of the list", () => {
    const s = store();
    s.dispatch({ type: "PREV" });
    expect(s.getState().activeId).toBe("aurora");
  });

  it("steps through the filtered set rather than every theme", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    s.dispatch({ type: "NEXT" });
    expect(s.getState().activeId).toBe("cinder");
  });

  it("does nothing when the filtered set is empty", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "zzz" });
    s.dispatch({ type: "NEXT" });
    expect(s.getState().activeId).toBeNull();
  });
});

describe("selectors", () => {
  it("numbers rows by their position in the unfiltered list", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    expect(selectRows(s.getState()).map((r) => r.number)).toEqual([1, 3]);
  });

  it("marks the active row", () => {
    const rows = selectRows(store().getState());
    expect(rows.filter((r) => r.isActive).map((r) => r.theme.id)).toEqual(["aurora"]);
  });

  it("lists categories with counts and All first", () => {
    expect(selectCategories(store().getState())).toEqual([
      { name: "All", count: 3, isActive: true },
      { name: "Blog", count: 2, isActive: false },
      { name: "Portfolio", count: 1, isActive: false },
    ]);
  });

  it("returns the active theme", () => {
    expect(selectActive(store().getState()).id).toBe("aurora");
  });

  it("reports the active position within the filtered set", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    s.dispatch({ type: "NEXT" });
    expect(selectActiveIndex(s.getState())).toBe(1);
  });

  it("numbers a theme by its position in the unfiltered list", () => {
    const state = store().getState();
    expect(selectNumberOf(state, "cinder")).toBe(3);
  });

  it("numbers an unknown theme as zero", () => {
    expect(selectNumberOf(store().getState(), "nope")).toBe(0);
  });

  it("gives a row and its preview caption the same number", () => {
    const s = store();
    s.dispatch({ type: "SET_CATEGORY", category: "Blog" });
    s.dispatch({ type: "NEXT" });
    const state = s.getState();
    const row = selectRows(state).find((r) => r.isActive);
    const padded = String(row.number).padStart(2, "0");
    expect(buildCounters(state).label).toBe(`${padded} — ${row.theme.name}`);
  });

  it("reports minus one when nothing is active", () => {
    const s = store();
    s.dispatch({ type: "SET_QUERY", query: "zzz" });
    expect(selectActiveIndex(s.getState())).toBe(-1);
  });
});
