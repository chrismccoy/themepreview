/**
 * The shape a theme takes
 */

/**
 * Keeps a demo address only when it is an absolute `http` or `https` URL.
 */
function httpUrl(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

/**
 * Normalize one row from the REST response
 */
export function normalizeTheme(row) {
  if (!row || typeof row !== "object") return null;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;

  return {
    id,
    name,
    category:
      typeof row.category === "string" && row.category.trim()
        ? row.category.trim()
        : "Uncategorized",
    image: typeof row.image === "string" ? row.image : "",
    url: httpUrl(row.url),
  };
}
