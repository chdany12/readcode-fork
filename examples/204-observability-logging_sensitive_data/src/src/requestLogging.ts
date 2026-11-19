import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

const REDACTED_HEADERS = ["Authorization", "Cookie", "X-Sync-Device-Secret"];
const REDACTED_QUERY = new Set(["access_token", "share_key"]);
const MAX_BODY_PREVIEW = 256;

function scrubHeaders(headers: Request["headers"]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...headers };
  for (const name of REDACTED_HEADERS) {
    if (name in out) out[name] = "[redacted]";
  }
  return out;
}

function scrubQuery(query: Request["query"]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    out[k] = REDACTED_QUERY.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

function bodyPreview(req: Request): string | undefined {
  if (req.is("application/octet-stream")) return undefined;
  if (!req.body || typeof req.body !== "object") return undefined;
  const { contents, ...meta } = req.body as Record<string, unknown>;
  const text = JSON.stringify(meta);
  return text.length > MAX_BODY_PREVIEW ? `${text.slice(0, MAX_BODY_PREVIEW)}...` : text;
}

export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.header("x-request-id") as string) || randomUUID();
  const started = process.hrtime.bigint();
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const entry = {
      requestId,
      method: req.method,
      route: req.route?.path ?? req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      deviceId: req.header("x-sync-device-id"),
    };
    if (res.statusCode >= 500) {
      logger.error(
        { ...entry, headers: scrubHeaders(req.headers), query: scrubQuery(req.query), body: bodyPreview(req) },
        "sync request failed",
      );
    } else {
      logger.info(entry, "sync request");
    }
  });

  next();
}
