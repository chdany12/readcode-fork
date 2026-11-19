import express from "express";
import { requestLogging } from "./requestLogging";
import { logger } from "./logger";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(requestLogging);

app.put("/v1/files/:fileId/chunks/:index", express.raw({ limit: "8mb" }), async (req, res) => {
  res.status(204).end();
});

app.post("/v1/sync/cursor", async (req, res) => {
  const { cursor } = req.body ?? {};
  if (typeof cursor !== "string") {
    res.status(400).json({ error: "cursor required" });
    return;
  }
  res.json({ cursor, changes: [] });
});

app.listen(Number(process.env.PORT ?? 8080), () => logger.info("sync-api listening"));
