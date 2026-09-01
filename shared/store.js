/**
 * The previewer's state container.
 */

const ALL = "All";

/**
 * Tests one theme against the current filter.
 */
function matches(theme, query, category) {
  const inCategory = category === ALL || theme.category === category;
  if (!inCategory) return false;
  if (!query) return true;
  return `${theme.name} ${theme.category}`.toLowerCase().includes(query.toLowerCase());
}

/**
 * Filter results, keyed by the state
 */
const filterResults = new WeakMap();

const ordinals = new WeakMap();

/**
 * Returns the themes matching the current filter.
 */
export function selectFiltered(state) {
  const cached = filterResults.get(state);
  if (cached) return cached;
  const value = state.themes.filter((theme) => matches(theme, state.query, state.category));
  filterResults.set(state, value);
  return value;
}

/**
 * Returns each theme's one based position in the unfiltered list.
 */
function selectOrdinals(state) {
  const cached = ordinals.get(state);
  if (cached) return cached;
  const value = new Map(state.themes.map((theme, i) => [theme.id, i + 1]));
  ordinals.set(state, value);
  return value;
}

/**
 * Returns one theme's position in the unfiltered list.
 */
export function selectNumberOf(state, id) {
  return selectOrdinals(state).get(id) ?? 0;
}

/**
 * Returns the selected theme.
 */
export function selectActive(state) {
  return state.themes.find((t) => t.id === state.activeId) ?? null;
}

/**
 * Returns the selected theme's position within the filtered set.
 */
export function selectActiveIndex(state) {
  return selectFiltered(state).findIndex((t) => t.id === state.activeId);
}

/**
 * Builds the render-ready list rows.
 */
export function selectRows(state) {
  const numbers = selectOrdinals(state);
  return selectFiltered(state).map((theme) => ({
    theme,
    number: numbers.get(theme.id),
    isActive: theme.id === state.activeId,
  }));
}

/**
 * Builds the category filter buttons.
 */
export function selectCategories(state) {
  const counts = new Map();
  for (const theme of state.themes) {
    counts.set(theme.category, (counts.get(theme.category) ?? 0) + 1);
  }
  return [
    { name: ALL, count: state.themes.length, isActive: state.category === ALL },
    ...[...counts.entries()].map(([name, count]) => ({
      name,
      count,
      isActive: state.category === name,
    })),
  ];
}

/**
 * Re-points `activeId` at the filtered set when the filter moves
 */
function withValidActive(state) {
  const visible = selectFiltered(state);
  if (visible.some((t) => t.id === state.activeId)) return state;
  return withActive(state, visible.length ? visible[0].id : null, visible);
}

/**
 * Builds a state differing only in `activeId`, carrying the filter result over.
 */
function withActive(state, activeId, visible) {
  if (activeId === state.activeId) return state;
  const next = { ...state, activeId };
  filterResults.set(next, visible);
  return next;
}

/**
 * Moves the selection through the filtered set.
 */
function step(state, delta) {
  const visible = selectFiltered(state);
  const index = visible.findIndex((t) => t.id === state.activeId);
  if (index === -1) return state;
  const next = index + delta;
  if (next < 0 || next >= visible.length) return state;
  return withActive(state, visible[next].id, visible);
}

/**
 * Applies an action to the state.
 */
export function reduce(state, action) {
  switch (action.type) {
    case "SET_QUERY": {
      const query = action.query ?? "";
      if (query === state.query) return state;
      return withValidActive({ ...state, query });
    }
    case "SET_CATEGORY": {
      const category = action.category ?? ALL;
      if (category === state.category) return state;
      return withValidActive({ ...state, category });
    }
    case "SELECT": {
      if (action.id === state.activeId) return state;
      const visible = selectFiltered(state);
      if (!visible.some((t) => t.id === action.id)) return state;
      return withActive(state, action.id, visible);
    }
    case "NEXT":
      return step(state, 1);
    case "PREV":
      return step(state, -1);
    default:
      return state;
  }
}

/**
 * Creates a store.
 */
export function createStore({ themes = [], activeId, query = "", category = ALL } = {}) {
  let state = withValidActive({
    themes,
    activeId: activeId ?? null,
    query,
    category,
  });

  const listeners = new Set();

  return {
    getState: () => state,

    /**
     * Registers a listener.
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Applies an action and notifies listeners if anything changed.
     */
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return state;
      const previous = state;
      state = next;
      for (const listener of listeners) listener(state, previous);
      return state;
    },
  };
}
