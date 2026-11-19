import { Router, Request, Response, NextFunction } from "express";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { ReplayIndex } from "./replayIndex";

const REPLAY_ROOT = process.env.REPLAY_ROOT ?? "/var/lib/arena/replays";

export function replayRouter(index: ReplayIndex): Router {
  const router = Router();

  router.get("/matches/:matchId/replay", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = res.locals.playerId as string | undefined;
      if (!playerId) {
        res.status(401).end();
        return;
      }

      const meta = await index.find(req.params.matchId);
      if (!meta) {
        res.status(404).json({ error: "replay_not_found" });
        return;
      }
      if (!meta.participants.includes(playerId) && meta.visibility !== "public") {
        res.status(403).json({ error: "replay_private" });
        return;
      }

      const filePath = path.join(REPLAY_ROOT, meta.shard, `${meta.matchId}.rpl`);
      const stat = await fsp.stat(filePath).catch(() => null);
      if (!stat) {
        res.status(410).json({ error: "replay_expired" });
        return;
      }

      if (req.headers["if-none-match"] === meta.etag) {
        res.status(304).end();
        return;
      }

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", String(stat.size));
      res.setHeader("ETag", meta.etag);
      res.setHeader("Cache-Control", "private, max-age=86400");

      const data = await fsp.readFile(filePath);
      res.end(data);
      index.recordDownload(meta.matchId, playerId).catch(() => undefined);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
