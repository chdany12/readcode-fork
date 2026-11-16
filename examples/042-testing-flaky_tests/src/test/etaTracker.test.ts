import { describe, it, expect, beforeEach } from "vitest";
import { Clock, DeliveryEtaTracker, distanceMeters } from "../src/etaTracker";

class ManualClock implements Clock {
  constructor(private t: number) {}
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

const T0 = Date.UTC(2026, 0, 15, 18, 30, 0);
const DROP = { lat: 40.7411, lng: -73.9897 };
const START = { lat: 40.7484, lng: -73.9857 };

describe("DeliveryEtaTracker", () => {
  let clock: ManualClock;
  let tracker: DeliveryEtaTracker;

  beforeEach(() => {
    clock = new ManualClock(T0);
    tracker = new DeliveryEtaTracker(clock, 6, 60_000);
  });

  it("estimates travel time from the latest ping", () => {
    tracker.ingest({ courierId: "c1", orderId: "o1", ...START, at: T0 });
    const expected = Math.round((distanceMeters(START.lat, START.lng, DROP.lat, DROP.lng) / 6) * 1000);

    const eta = tracker.estimate("o1", DROP.lat, DROP.lng);

    expect(eta).toEqual({ orderId: "o1", etaMs: expected, stale: false });
  });

  it("ignores pings that arrive out of order", () => {
    tracker.ingest({ courierId: "c1", orderId: "o1", lat: DROP.lat, lng: DROP.lng, at: T0 + 5_000 });
    tracker.ingest({ courierId: "c1", orderId: "o1", ...START, at: T0 + 1_000 });
    clock.advance(5_000);

    expect(tracker.estimate("o1", DROP.lat, DROP.lng)?.etaMs).toBe(0);
  });

  it("subtracts time elapsed since the ping", () => {
    tracker.ingest({ courierId: "c1", orderId: "o1", ...START, at: T0 });
    const fresh = tracker.estimate("o1", DROP.lat, DROP.lng)!.etaMs;

    clock.advance(30_000);

    expect(tracker.estimate("o1", DROP.lat, DROP.lng)!.etaMs).toBe(fresh - 30_000);
  });

  it("flags estimates as stale once the ping is older than the threshold", () => {
    tracker.ingest({ courierId: "c1", orderId: "o1", ...START, at: T0 });
    clock.advance(60_000);
    expect(tracker.estimate("o1", DROP.lat, DROP.lng)!.stale).toBe(false);

    clock.advance(1);
    expect(tracker.estimate("o1", DROP.lat, DROP.lng)!.stale).toBe(true);
  });

  it("forgets an order once it is completed", () => {
    tracker.ingest({ courierId: "c1", orderId: "o1", ...START, at: T0 });
    tracker.complete("o1");
    expect(tracker.estimate("o1", DROP.lat, DROP.lng)).toBeNull();
  });
});
