import { FareQuote, FareSupplier, RedisClient } from "./types";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MIN_TTL_MS = 15 * 1000;

export class FareQuoteCache {
  constructor(
    private readonly redis: RedisClient,
    private readonly supplier: FareSupplier,
    private readonly now: () => number = Date.now,
  ) {}

  private key(origin: string, dest: string, date: string, cabin: string): string {
    return `fare:v2:${origin}:${dest}:${date}:${cabin}`;
  }

  async getQuote(
    origin: string,
    dest: string,
    date: string,
    cabin: FareQuote["cabin"],
  ): Promise<FareQuote> {
    const key = this.key(origin, dest, date, cabin);
    const raw = await this.redis.get(key);
    if (raw) {
      const cached = JSON.parse(raw) as FareQuote;
      if (cached.validUntil > this.now()) {
        return cached;
      }
      await this.redis.del(key);
    }

    const fresh = await this.supplier.quote(origin, dest, date, cabin);
    const ttlMs = this.ttlFor(fresh);
    if (ttlMs > 0) {
      await this.redis.set(key, JSON.stringify(fresh), "EX", ttlMs);
    }
    return fresh;
  }

  private ttlFor(quote: FareQuote): number {
    const remaining = quote.validUntil - this.now();
    if (remaining <= MIN_TTL_MS) {
      return 0;
    }
    return Math.min(remaining, DEFAULT_TTL_MS);
  }
}
