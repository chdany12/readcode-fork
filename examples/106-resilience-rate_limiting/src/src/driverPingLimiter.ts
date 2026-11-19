export interface TokenBucketPolicy {
  burst: number;
  ratePerSec: number;
}

interface State {
  tokens: number;
  updatedAt: number;
}

export class DriverPingLimiter {
  private readonly state = new Map<string, State>();

  constructor(
    private readonly policy: TokenBucketPolicy,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  allow(driverId: string): { allowed: boolean; waitMs: number } {
    const t = this.clock();
    const prev = this.state.get(driverId);
    const elapsedSec = prev ? Math.max(0, (t - prev.updatedAt) / 1000) : 0;
    const available = prev
      ? Math.min(this.policy.burst, prev.tokens + elapsedSec * this.policy.ratePerSec)
      : this.policy.burst;

    if (available >= 1) {
      this.state.set(driverId, { tokens: available - 1, updatedAt: t });
      return { allowed: true, waitMs: 0 };
    }

    this.state.set(driverId, { tokens: available, updatedAt: t });
    const waitMs = ((1 - available) / this.policy.ratePerSec) * 1000;
    return { allowed: false, waitMs: Math.ceil(waitMs) };
  }

  forget(driverId: string) {
    this.state.delete(driverId);
  }

  size() {
    return this.state.size;
  }
}
