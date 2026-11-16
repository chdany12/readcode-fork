import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";
import { ByteRange, SegmentStore } from "./segmentStore";

export function parseRange(header: string | undefined, size: number): ByteRange | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";

  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    return { start: Math.max(0, size - suffix), endExclusive: size };
  }

  const start = Number(m[1]);
  const lastInclusive = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > lastInclusive) return "invalid";
  return { start, endExclusive: lastInclusive + 1 };
}

export function makeSegmentHandler(store: SegmentStore) {
  return async (req: IncomingMessage, res: ServerResponse, key: string): Promise<void> => {
    const meta = await store.stat(key);
    if (!meta) {
      res.writeHead(404).end();
      return;
    }

    const range = parseRange(req.headers.range, meta.sizeBytes);
    if (range === "invalid") {
      res.writeHead(416, { "Content-Range": `bytes */${meta.sizeBytes}` }).end();
      return;
    }

    const headers: Record<string, string | number> = {
      "Content-Type": meta.contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    if (range) {
      headers["Content-Range"] = `bytes ${range.start}-${range.endExclusive - 1}/${meta.sizeBytes}`;
      headers["Content-Length"] = range.endExclusive - range.start;
      res.writeHead(206, headers);
    } else {
      headers["Content-Length"] = meta.sizeBytes;
      res.writeHead(200, headers);
    }

    const body = await store.open(key, range ?? undefined);
    await pipeline(body, res);
  };
}
