/**
 * The route table.
 */

import express from "express";
import { createPreviewerHandler } from "../controllers/previewer.js";
import { createHealthHandler } from "../controllers/health.js";

/**
 * Builds the router.
 */
export function createRouter({ config, cache, templates }) {
  const router = express.Router();

  router.get("/", createPreviewerHandler({ config, cache, templates }));
  router.get("/health", createHealthHandler({ cache }));

  return router;
}
