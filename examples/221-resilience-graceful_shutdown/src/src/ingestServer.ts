import http from "http";
import { ImpressionBatcher } from "./impressionBatcher";

export function createIngestServer(batcher: ImpressionBatcher): http.Server {
  return http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/impressions") {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) {
        res.writeHead(413).end();
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!Array.isArray(body.events)) throw new Error("events must be an array");
        for (const e of body.events) batcher.add(e);
        res.writeHead(202, { "content-type": "application/json" }).end('{"accepted":true}');
      } catch (err) {
        res.writeHead(400).end(JSON.stringify({ error: (err as Error).message }));
      }
    });
  });
}
