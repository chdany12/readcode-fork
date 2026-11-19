export interface BucketConfig {
  capacity: number;
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export type Decision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export class MerchantRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly config: BucketConfig,
    private readonly now: () => number = Date.now,
  ) {}

  tryConsume(merchantId: string, cost = 1): Decision {
    const nowMs = this.now();
    let bucket = this.buckets.get(merchantId);
    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefillMs: nowMs };
      this.buckets.set(merchantId, bucket);
    }

    const elapsedSec = (nowMs - bucket.lastRefillMs) / 1000;
    bucket.tokens = bucket.tokens + elapsedSec * this.config.refillPerSecond;
    bucket.lastRefillMs = nowMs;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const deficit = cost - bucket.tokens;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(deficit / this.config.refillPerSecond),
    };
  }

  evictIdle(maxIdleMs: number): number {
    const cutoff = this.now() - maxIdleMs;
    let removed = 0;
    for (const [id, b] of this.buckets) {
      if (b.lastRefillMs < cutoff) {
        this.buckets.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
