import { DriverPingLimiter } from "./driverPingLimiter";

export interface LocationPing {
  driverId: string;
  lat: number;
  lng: number;
  recordedAt: number;
}

export interface DispatchIndex {
  upsertDriverPosition(ping: LocationPing): Promise<void>;
}

export interface Metrics {
  increment(name: string, tags?: Record<string, string>): void;
}

export class LocationIngest {
  private readonly limiter = new DriverPingLimiter({ burst: 3, ratePerSec: 1 });

  constructor(
    private readonly index: DispatchIndex,
    private readonly metrics: Metrics,
  ) {}

  async onPing(ping: LocationPing): Promise<{ status: number; retryAfterMs?: number }> {
    if (
      !Number.isFinite(ping.lat) || Math.abs(ping.lat) > 90 ||
      !Number.isFinite(ping.lng) || Math.abs(ping.lng) > 180
    ) {
      this.metrics.increment("location.ping.invalid");
      return { status: 400 };
    }

    const { allowed, waitMs } = this.limiter.allow(ping.driverId);
    if (!allowed) {
      this.metrics.increment("location.ping.throttled");
      return { status: 429, retryAfterMs: waitMs };
    }

    await this.index.upsertDriverPosition(ping);
    this.metrics.increment("location.ping.accepted");
    return { status: 202 };
  }

  onDriverOffline(driverId: string) {
    this.limiter.forget(driverId);
  }
}
