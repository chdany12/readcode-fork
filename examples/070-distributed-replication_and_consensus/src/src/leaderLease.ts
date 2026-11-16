import { LeaseStore } from "./leaseStore";

export interface LeaderLeaseOptions {
  leaseName: string;
  holderId: string;
  leaseMs: number;
  renewEveryMs: number;
  safetyMarginMs: number;
}

export class LeaderLease {
  private leaseExpiresAt = 0;
  private fencingToken = 0;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly store: LeaseStore, private readonly opts: LeaderLeaseOptions) {
    if (opts.renewEveryMs >= opts.leaseMs - opts.safetyMarginMs) {
      throw new Error("renewEveryMs must be well below the lease duration");
    }
  }

  start(): void {
    void this.tick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.isLeader()) {
      await this.store.release(this.opts.leaseName, this.opts.holderId, this.fencingToken);
    }
    this.leaseExpiresAt = 0;
  }

  isLeader(): boolean {
    return Date.now() < this.leaseExpiresAt - this.opts.safetyMarginMs;
  }

  token(): number {
    return this.fencingToken;
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    try {
      const result = await this.store.tryAcquire(this.opts.leaseName, this.opts.holderId, this.opts.leaseMs);
      if (result.acquired) {
        this.fencingToken = result.fencingToken;
        this.leaseExpiresAt = Date.now() + this.opts.leaseMs;
      } else {
        this.leaseExpiresAt = 0;
      }
    } catch (err) {
      console.error("lease renewal failed", { lease: this.opts.leaseName, err });
    }
    if (!this.stopped) {
      this.timer = setTimeout(() => void this.tick(), this.opts.renewEveryMs);
    }
  }
}
