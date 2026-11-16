import { KeyValueStore } from "./kv";

export interface LockoutPolicy {
  maxFailures: number;
  windowSeconds: number;
  lockSeconds: number;
}

export type LoginGate = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class LoginThrottle {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly policy: LockoutPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  private failKey(username: string) {
    return `auth:fail:${username.toLowerCase()}`;
  }

  private lockKey(username: string) {
    return `auth:lock:${username.toLowerCase()}`;
  }

  async check(username: string): Promise<LoginGate> {
    const lockedUntil = await this.kv.get(this.lockKey(username));
    if (lockedUntil) {
      const remainingMs = Number(lockedUntil) - this.now();
      if (remainingMs > 0) {
        return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
      }
    }
    return { allowed: true };
  }

  async recordFailure(username: string): Promise<void> {
    const key = this.failKey(username);
    const current = Number((await this.kv.get(key)) ?? "0");
    const failures = current + 1;
    await this.kv.set(key, String(failures), { ttlSeconds: this.policy.windowSeconds });

    if (failures >= this.policy.maxFailures) {
      const until = this.now() + this.policy.lockSeconds * 1000;
      await this.kv.set(this.lockKey(username), String(until), {
        ttlSeconds: this.policy.lockSeconds,
      });
      await this.kv.del(key);
    }
  }

  async recordSuccess(username: string): Promise<void> {
    await this.kv.del(this.failKey(username));
  }
}
