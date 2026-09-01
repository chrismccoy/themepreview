/**
 * Compiles the EJS partials that both the server and the browser render.
 */

import fs from "node:fs";
import path from "node:path";
import ejs from "ejs";

/**
 * Partials rendered on both sides, by exported name.
 */
const SHARED_PARTIALS = {
  themeItem: "theme-item.ejs",
  categoryPill: "category-pill.ejs",
};

/**
 * Compiles the shared partials.
 */
export function loadTemplates(viewsDir) {
  const compiled = Object.entries(SHARED_PARTIALS).map(([name, file]) => {
    const source = fs.readFileSync(path.join(viewsDir, "partials", file), "utf8");
    return [name, ejs.compile(source, { client: true, rmWhitespace: true, compileDebug: false })];
  });

  const render = Object.fromEntries(
    compiled.map(([name, fn]) => [name, (locals) => fn(locals, ejs.escapeXML)])
  );

  const clientJs = `window.__TPL__={${compiled
    .map(([name, fn]) => `${name}:${fn.toString()}`)
    .join(",")}};`;

  return { render, clientJs };
}
