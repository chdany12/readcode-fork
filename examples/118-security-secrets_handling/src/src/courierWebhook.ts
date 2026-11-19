import { createHmac, timingSafeEqual } from "node:crypto";
import type { SigningKeys } from "./secrets";

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
}

export interface DeliveryStatusEvent {
  orderId: string;
  courierId: string;
  status: "picked_up" | "delivered" | "failed";
  occurredAt: string;
}

const MAX_SKEW_SECONDS = 300;

function sign(key: Buffer, timestamp: string, body: string): Buffer {
  return createHmac("sha256", key).update(`${timestamp}.${body}`).digest();
}

function matches(expected: Buffer, provided: Buffer): boolean {
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export class CourierWebhookVerifier {
  constructor(private readonly keys: SigningKeys, private readonly log: Logger) {}

  verify(headers: Record<string, string | undefined>, rawBody: string, nowSeconds: number): DeliveryStatusEvent | null {
    const timestamp = headers["x-courier-timestamp"];
    const signatureHex = headers["x-courier-signature"];
    if (!timestamp || !signatureHex || !/^[0-9a-f]{64}$/i.test(signatureHex)) {
      this.log.warn("courier webhook rejected", { reason: "missing_or_malformed_headers" });
      return null;
    }

    const ts = Number(timestamp);
    if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) {
      this.log.warn("courier webhook rejected", { reason: "stale_timestamp", timestamp });
      return null;
    }

    const provided = Buffer.from(signatureHex, "hex");
    const candidates = [this.keys.current, this.keys.previous].filter((k): k is Buffer => k !== null);
    const ok = candidates.some((key) => matches(sign(key, timestamp, rawBody), provided));
    if (!ok) {
      this.log.warn("courier webhook rejected", { reason: "bad_signature", bodyBytes: rawBody.length });
      return null;
    }

    const event = JSON.parse(rawBody) as DeliveryStatusEvent;
    this.log.info("courier webhook accepted", { orderId: event.orderId, status: event.status });
    return event;
  }
}
