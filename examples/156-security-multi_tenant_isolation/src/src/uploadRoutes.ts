import express from "express";
import { Pool } from "pg";
import { ObjectStore } from "./objectStore";
import { UploadError, VideoUploadService } from "./videoUploadService";

type TenantResolver = (apiKey: string) => Promise<string | null>;

export function uploadRoutes(db: Pool, store: ObjectStore, resolveTenant: TenantResolver) {
  const service = new VideoUploadService(db, store);
  const router = express.Router();
  router.use(express.json({ limit: "8kb" }));

  router.use(async (req, res, next) => {
    const apiKey = req.header("x-api-key");
    const tenantId = apiKey ? await resolveTenant(apiKey) : null;
    if (!tenantId) return res.status(401).json({ error: "invalid api key" });
    res.locals.tenantId = tenantId;
    next();
  });

  router.post("/uploads", async (req, res, next) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.slice(0, 200) : "";
      if (!title) return res.status(400).json({ error: "title required" });
      const ticket = await service.begin(res.locals.tenantId, title);
      res.status(201).json(ticket);
    } catch (err) {
      next(err);
    }
  });

  router.post("/uploads/:videoId/complete", async (req, res, next) => {
    try {
      const objectKey = req.body?.objectKey;
      if (typeof objectKey !== "string") return res.status(400).json({ error: "objectKey required" });
      await service.complete(res.locals.tenantId, req.params.videoId, objectKey);
      res.status(202).json({ status: "processing" });
    } catch (err) {
      if (err instanceof UploadError) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  return router;
}
