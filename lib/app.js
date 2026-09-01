/**
 * Builds the application.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import compression from "compression";
import { createRouter } from "../routes/index.js";
import { createImageSource } from "../services/image-source.js";
import { viewLocals } from "../middleware/view-locals.js";
import { security } from "../middleware/security.js";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewsDir = path.join(rootDir, "views");
const publicDir = path.join(rootDir, "public");
const sharedDir = path.join(rootDir, "shared");

/**
 * Builds the screenshot fetcher options from the configuration.
 */
function defaultImageSourceOptions(config) {
  return {
    imageHosts: config.imageHosts,
    timeoutMs: config.imageTimeoutMs,
    maxBytes: config.maxImageBytes,
  };
}

/**
 * Assembles the middleware stack and routes.
 */
export function createApp({
  config,
  cache,
  imageSource = createImageSource(defaultImageSourceOptions(config)),
}) {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", viewsDir);
  app.disable("x-powered-by");

  app.use(viewLocals(config));
  app.use(security(config));

  app.use(compression());
  app.use(express.static(publicDir, { maxAge: config.isProduction ? "1h" : 0 }));
  app.use("/shared", express.static(sharedDir, { maxAge: config.isProduction ? "1h" : 0 }));
  app.use(createRouter({ config, cache, imageSource }));

  return app;
}
