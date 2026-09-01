/**
 * The route table.
 */

import express from "express";
import { createPreviewerHandler } from "../controllers/previewer.js";
import { createHealthHandler } from "../controllers/health.js";
import { createMediaHandler } from "../controllers/media.js";

/**
 * Builds the router.
 */
export function createRouter({ config, cache, imageSource }) {
  const router = express.Router();

  router.get("/", createPreviewerHandler({ config, cache }));
  router.get("/media/theme/:id", createMediaHandler({ cache, imageSource }));
  router.get("/health", createHealthHandler({ cache }));

  return router;
}
