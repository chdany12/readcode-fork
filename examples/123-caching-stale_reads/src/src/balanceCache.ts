import Redis from "ioredis";
import type { Balance } from "./ledgerService";

const TTL_SECONDS = 300;

export class BalanceCache {
  constructor(private readonly redis: Redis) {}

  private key(accountId: string): string {
    return `balance:v1:${accountId}`;
  }

  async get(accountId: string): Promise<Balance | null> {
    try {
      const raw = await this.redis.get(this.key(accountId));
      return raw ? (JSON.parse(raw) as Balance) : null;
    } catch {
      return null;
    }
  }

  async set(balance: Balance): Promise<void> {
    await this.redis.set(this.key(balance.accountId), JSON.stringify(balance), "EX", TTL_SECONDS);
  }

  async invalidate(...accountIds: string[]): Promise<void> {
    if (accountIds.length === 0) return;
    await this.redis.del(...accountIds.map((id) => this.key(id)));
  }
}
