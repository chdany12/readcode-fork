import { Router } from "express";
import { PlaybackSessionService, ConcurrentStreamLimitError } from "./playbackSessionService";

export function playbackRoutes(sessions: PlaybackSessionService): Router {
  const router = Router();

  router.post("/playback/sessions", async (req, res, next) => {
    const { deviceId, titleId } = req.body ?? {};
    if (typeof deviceId !== "string" || typeof titleId !== "string") {
      res.status(400).json({ error: "deviceId and titleId are required" });
      return;
    }
    try {
      const s = await sessions.start(res.locals.accountId, deviceId, titleId);
      res.status(201).json(s);
    } catch (err) {
      if (err instanceof ConcurrentStreamLimitError) {
        res.status(409).json({ error: "stream_limit", limit: err.limit });
        return;
      }
      next(err);
    }
  });

  router.post("/playback/sessions/:id/heartbeat", async (req, res, next) => {
    try {
      const alive = await sessions.heartbeat(req.params.id);
      res.status(alive ? 204 : 410).end();
    } catch (err) {
      next(err);
    }
  });

  router.delete("/playback/sessions/:id", async (req, res, next) => {
    try {
      await sessions.stop(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
