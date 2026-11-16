import { MerchantRateLimiter } from "./merchantRateLimiter";

export interface ChargeRequest {
  merchantId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  lineItems: number;
}

export interface Processor {
  charge(req: ChargeRequest): Promise<{ chargeId: string }>;
}

type HttpResult = { status: number; headers?: Record<string, string>; body: unknown };

const limiter = new MerchantRateLimiter({ capacity: 50, refillPerSecond: 10 });

setInterval(() => limiter.evictIdle(10 * 60_000), 60_000).unref();

export async function createCharge(
  req: ChargeRequest,
  processor: Processor,
): Promise<HttpResult> {
  if (!req.idempotencyKey) {
    return { status: 400, body: { error: "idempotency_key_required" } };
  }

  const cost = req.lineItems > 20 ? 2 : 1;
  const decision = limiter.tryConsume(req.merchantId, cost);

  if (!decision.allowed) {
    return {
      status: 429,
      headers: { "Retry-After": String(decision.retryAfterSeconds) },
      body: { error: "rate_limited" },
    };
  }

  try {
    const { chargeId } = await processor.charge(req);
    return {
      status: 201,
      headers: { "X-RateLimit-Remaining": String(decision.remaining) },
      body: { chargeId },
    };
  } catch {
    return { status: 502, body: { error: "processor_error" } };
  }
}
