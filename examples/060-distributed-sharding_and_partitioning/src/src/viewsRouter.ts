import express from "express";
import { ViewCounter } from "./viewCounter";

export function viewsRouter(counter: ViewCounter): express.Router {
  const router = express.Router();

  router.post("/videos/:videoId/views", async (req, res) => {
    const session = req.header("x-session-id");
    if (!session) {
      res.status(400).json({ error: "missing session" });
      return;
    }
    try {
      await counter.record(req.params.videoId, session);
      res.status(202).end();
    } catch (err) {
      req.log?.warn({ err, videoId: req.params.videoId }, "view not recorded");
      res.status(202).end();
    }
  });

  router.get("/videos/:videoId/views", async (req, res, next) => {
    try {
      const total = await counter.total(req.params.videoId);
      res.json({ videoId: req.params.videoId, views: total });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/videos/:videoId/views", async (req, res, next) => {
    try {
      await counter.reset(req.params.videoId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
