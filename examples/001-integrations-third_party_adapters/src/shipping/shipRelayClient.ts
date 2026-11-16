import { randomUUID } from "crypto";
import { CarrierError, CarrierErrorKind } from "./errors";

export interface ShipRelayConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
}

type HttpMethod = "GET" | "POST";

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export class ShipRelayClient {
  constructor(private readonly cfg: ShipRelayConfig) {}

  async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    let lastError: CarrierError | undefined;

    for (let attempt = 1; attempt <= this.cfg.maxAttempts; attempt++) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        "Content-Type": "application/json",
      };
      if (method === "POST") {
        headers["Idempotency-Key"] = randomUUID();
      }

      try {
        const res = await fetch(`${this.cfg.baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.cfg.timeoutMs),
        });

        if (res.ok) {
          return (await res.json()) as T;
        }

        const text = await res.text();
        lastError = CarrierError.fromStatus(res.status, text);
        if (!RETRYABLE_STATUS.has(res.status)) {
          throw lastError;
        }
        const retryAfter = Number(res.headers.get("Retry-After"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      } catch (err) {
        if (err instanceof CarrierError && err.kind !== CarrierErrorKind.Unavailable) {
          throw err;
        }
        lastError =
          err instanceof CarrierError
            ? err
            : new CarrierError(CarrierErrorKind.Unavailable, `ShipRelay ${method} ${path} failed`, err);
        await sleep(backoff(attempt));
      }
    }

    throw lastError ?? new CarrierError(CarrierErrorKind.Unavailable, "ShipRelay: no attempts made");
  }
}

function backoff(attempt: number): number {
  const base = 200 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
