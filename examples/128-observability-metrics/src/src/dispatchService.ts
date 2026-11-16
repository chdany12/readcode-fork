import { Counter, Histogram } from "./metrics";

export type MatchOutcome = "matched" | "no_drivers" | "rider_cancelled" | "error";

const KNOWN_REGIONS = new Set(["sfo", "nyc", "lax", "sea", "chi"]);

export interface DispatchRequest {
  rideId: string;
  riderId: string;
  regionCode: string;
  pickup: { lat: number; lng: number };
}

export interface DriverMatcher {
  findDriver(req: DispatchRequest, signal: AbortSignal): Promise<string | null>;
}

export const matchLatency = new Histogram("dispatch_match_seconds", [0.25, 0.5, 1, 2, 5, 10, 30]);
export const matchOutcomes = new Counter("dispatch_match_total");

function regionLabel(code: string): string {
  const normalized = code.trim().toLowerCase();
  return KNOWN_REGIONS.has(normalized) ? normalized : "other";
}

export class DispatchService {
  constructor(private readonly matcher: DriverMatcher, private readonly timeoutMs = 30_000) {}

  async dispatch(req: DispatchRequest, riderSignal: AbortSignal): Promise<string | null> {
    const region = regionLabel(req.regionCode);
    const started = process.hrtime.bigint();
    let outcome: MatchOutcome = "error";

    const controller = new AbortController();
    const onRiderAbort = () => controller.abort();
    riderSignal.addEventListener("abort", onRiderAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const driverId = await this.matcher.findDriver(req, controller.signal);
      if (driverId) {
        outcome = "matched";
      } else if (riderSignal.aborted) {
        outcome = "rider_cancelled";
      } else {
        outcome = "no_drivers";
      }
      return driverId;
    } catch (err) {
      outcome = riderSignal.aborted ? "rider_cancelled" : "error";
      if (riderSignal.aborted) return null;
      throw err;
    } finally {
      clearTimeout(timer);
      riderSignal.removeEventListener("abort", onRiderAbort);
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      matchLatency.observe({ region, outcome }, seconds);
      matchOutcomes.inc({ region, outcome });
    }
  }
}
