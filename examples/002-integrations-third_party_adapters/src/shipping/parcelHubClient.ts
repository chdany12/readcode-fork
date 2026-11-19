import {
  CarrierError,
  CarrierRateLimitedError,
  CarrierUnavailableError,
  InvalidAddressError,
  Label,
  ShipmentRequest,
} from "./types";

export interface ParcelHubConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
  baseBackoffMs: number;
  maxRetryWaitMs: number;
}

type ParcelHubLabelResponse = {
  id: string;
  tracking_code: string;
  label: { url: string };
  rate: { amount: string; currency: string };
};

type ParcelHubErrorBody = { error?: { code?: string; field?: string; message?: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ParcelHubClient {
  constructor(private readonly cfg: ParcelHubConfig) {}

  async createLabel(req: ShipmentRequest): Promise<Label> {
    const idempotencyKey = `label-${req.orderId}`;
    const body = {
      shipment: {
        reference: req.orderId,
        from_address: toProviderAddress(req.from),
        to_address: toProviderAddress(req.to),
        parcel: { weight_oz: Math.ceil(req.weightGrams / 28.3495) },
        service: req.serviceLevel === "express" ? "NEXT_DAY" : "GROUND",
      },
    };
    const res = await this.withRetries(() =>
      this.send<ParcelHubLabelResponse>("POST", "/v2/labels", body, idempotencyKey),
    );
    return {
      carrierShipmentId: res.id,
      trackingNumber: res.tracking_code,
      labelUrl: res.label.url,
      cost: { amountCents: toCents(res.rate.amount), currency: res.rate.currency },
    };
  }

  private async withRetries<T>(op: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.cfg.maxAttempts; attempt++) {
      try {
        return await op();
      } catch (err) {
        lastError = err;
        if (!(err instanceof CarrierError) || !err.retryable || attempt === this.cfg.maxAttempts) {
          throw err;
        }
        let waitMs = this.cfg.baseBackoffMs * 2 ** (attempt - 1);
        if (err instanceof CarrierRateLimitedError) {
          if (err.retryAfterMs > this.cfg.maxRetryWaitMs) throw err;
          waitMs = Math.max(waitMs, err.retryAfterMs);
        }
        await sleep(Math.min(waitMs, this.cfg.maxRetryWaitMs));
      }
    }
    throw lastError;
  }

  private async send<T>(method: string, path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(`${this.cfg.baseUrl}${path}`, {
          method,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.cfg.apiKey}`,
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new CarrierUnavailableError(`parcelhub ${method} ${path} failed before response`, err);
      }

      if (res.ok) return (await res.json()) as T;

      const errBody = (await res.json().catch(() => ({}))) as ParcelHubErrorBody;
      if (res.status === 429) {
        const seconds = Number(res.headers.get("Retry-After"));
        throw new CarrierRateLimitedError(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000);
      }
      if (res.status === 422 && errBody.error?.code === "address_invalid") {
        throw new InvalidAddressError(errBody.error.field ?? "unknown", errBody.error.message ?? "invalid address");
      }
      if (res.status >= 500) {
        throw new CarrierUnavailableError(`parcelhub ${method} ${path} returned ${res.status}`);
      }
      throw new CarrierError(
        `parcelhub ${method} ${path} rejected: ${res.status} ${errBody.error?.code ?? "unknown"}`,
        false,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function toProviderAddress(a: ShipmentRequest["to"]) {
  return {
    name: a.name,
    street1: a.line1,
    street2: a.line2 ?? "",
    city: a.city,
    state: a.region,
    zip: a.postalCode,
    country: a.country,
  };
}

function toCents(decimal: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(decimal.trim());
  if (!match) throw new CarrierError(`unexpected rate amount "${decimal}"`, false);
  const [, whole, frac = ""] = match;
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
