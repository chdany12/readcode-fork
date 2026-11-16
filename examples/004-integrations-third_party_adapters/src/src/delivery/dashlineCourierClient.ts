import { randomUUID } from "crypto";

export interface CourierQuoteRequest {
  orderId: string;
  pickup: { address: string; readyAt: Date };
  dropoff: { address: string; phone: string };
  orderValueCents: number;
}

export interface CourierBooking {
  externalId: string;
  trackingUrl: string;
  feeCents: number;
}

export class CourierRejectedError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CourierRejectedError";
  }
}

export class CourierUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "CourierUnavailableError";
  }
}

interface DashlineDeliveryResponse {
  delivery_id: string;
  tracking_url: string;
  fee: { amount: string; currency: string };
}

export class DashlineCourierClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiToken: string,
    private readonly timeoutMs = 4000,
    private readonly maxAttempts = 3,
  ) {}

  async createDelivery(req: CourierQuoteRequest): Promise<CourierBooking> {
    const payload = {
      external_reference: req.orderId,
      pickup_address: req.pickup.address,
      pickup_time: req.pickup.readyAt.toISOString(),
      dropoff_address: req.dropoff.address,
      dropoff_phone_number: req.dropoff.phone,
      order_value: (req.orderValueCents / 100).toFixed(2),
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      if (attempt > 0) await delay(300 * 2 ** attempt);
      try {
        const res = await fetch(`${this.baseUrl}/v2/deliveries`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.status >= 500 || res.status === 429) {
          lastErr = new Error(`dashline http ${res.status}`);
          continue;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
          throw new CourierRejectedError(err.code ?? "unknown", err.message ?? `http ${res.status}`);
        }
        return toBooking((await res.json()) as DashlineDeliveryResponse);
      } catch (err) {
        if (err instanceof CourierRejectedError) throw err;
        lastErr = err;
      }
    }
    throw new CourierUnavailableError("dashline unavailable", lastErr);
  }
}

function toBooking(body: DashlineDeliveryResponse): CourierBooking {
  if (body.fee.currency !== "USD") {
    throw new CourierRejectedError("currency_mismatch", `unexpected currency ${body.fee.currency}`);
  }
  return {
    externalId: body.delivery_id,
    trackingUrl: body.tracking_url,
    feeCents: Math.round(Number(body.fee.amount) * 100),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
