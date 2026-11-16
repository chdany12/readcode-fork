import express from "express";
import { ManifestService } from "./manifestService";
import { OriginClient, OriginTimeoutError } from "./originClient";

const service = new ManifestService(new OriginClient(process.env.ORIGIN_URL ?? "http://origin.internal"));
export const router = express.Router();

router.get("/playback/:assetId/manifest", async (req, res) => {
  const maxBw = req.query.maxBandwidth ? Number(req.query.maxBandwidth) : undefined;
  try {
    const manifest = await service.getManifest(req.params.assetId, maxBw);
    res.set("cache-control", "private, max-age=10").json(manifest);
  } catch (err) {
    if (err instanceof OriginTimeoutError) {
      res.status(504).json({ error: "origin_timeout" });
      return;
    }
    res.status(502).json({ error: "origin_unavailable" });
  }
});
