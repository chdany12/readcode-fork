export interface SlidingWindowOptions {
  limit: number;
  windowMs: number;
  maxTrackedKeys: number;
}

export type LimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly opts: SlidingWindowOptions,
    private readonly clock: () => number = Date.now,
  ) {
    if (opts.limit < 1 || opts.windowMs <= 0) {
      throw new Error("SlidingWindowLimiter: limit must be >= 1 and windowMs > 0");
    }
  }

  check(key: string): LimitResult {
    const now = this.clock();
    const windowStart = now - this.opts.windowMs;

    const existing = this.hits.get(key) ?? [];
    let firstLive = 0;
    while (firstLive < existing.length && existing[firstLive] <= windowStart) {
      firstLive++;
    }
    const live = firstLive === 0 ? existing : existing.slice(firstLive);

    if (live.length >= this.opts.limit) {
      this.touch(key, live);
      const oldest = live[0];
      return { ok: false, retryAfterMs: oldest + this.opts.windowMs - now };
    }

    live.push(now);
    this.touch(key, live);
    return { ok: true, remaining: this.opts.limit - live.length };
  }

  private touch(key: string, timestamps: number[]) {
    this.hits.delete(key);
    this.hits.set(key, timestamps);
    if (this.hits.size > this.opts.maxTrackedKeys) {
      const lru = this.hits.keys().next().value as string;
      this.hits.delete(lru);
    }
  }
}
