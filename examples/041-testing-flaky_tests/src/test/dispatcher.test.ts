import { describe, it, expect, beforeEach } from "vitest";
import { Dispatcher, Driver, DriverLocator, Assignment } from "../src/dispatcher";

class FakeLocator implements DriverLocator {
  constructor(public drivers: Driver[], private readonly latencyMs = 0) {}
  async nearby(): Promise<Driver[]> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    return this.drivers;
  }
}

function collect(dispatcher: Dispatcher) {
  const assigned: Assignment[] = [];
  const unassigned: string[] = [];
  dispatcher.on("assigned", (a: Assignment) => assigned.push(a));
  dispatcher.on("unassigned", (id: string) => unassigned.push(id));
  return { assigned, unassigned };
}

describe("Dispatcher", () => {
  let drivers: Driver[];

  beforeEach(() => {
    drivers = [
      { id: "d-far", lat: 37.80, lng: -122.41, available: true },
      { id: "d-near", lat: 37.7751, lng: -122.4192, available: true },
    ];
  });

  it("assigns the closest available driver", async () => {
    const dispatcher = new Dispatcher(new FakeLocator(drivers));
    const { assigned } = collect(dispatcher);
    const done = new Promise((r) => dispatcher.once("assigned", r));

    dispatcher.submit({ rideId: "r1", riderId: "u1", pickupLat: 37.775, pickupLng: -122.4194 });
    await done;

    expect(assigned[0].driverId).toBe("d-near");
  });

  it("does not hand the same driver to two rides", async () => {
    const dispatcher = new Dispatcher(new FakeLocator(drivers, 5));
    const { assigned } = collect(dispatcher);

    dispatcher.submit({ rideId: "r1", riderId: "u1", pickupLat: 37.775, pickupLng: -122.4194 });
    dispatcher.submit({ rideId: "r2", riderId: "u2", pickupLat: 37.775, pickupLng: -122.4194 });
    await new Promise((r) => setTimeout(r, 15));

    expect(assigned.map((a) => a.driverId)).toEqual(["d-near", "d-far"]);
  });

  it("reports a ride as unassigned when nobody is free", async () => {
    drivers.forEach((d) => (d.available = false));
    const dispatcher = new Dispatcher(new FakeLocator(drivers));
    const { unassigned } = collect(dispatcher);
    const done = new Promise((r) => dispatcher.once("unassigned", r));

    dispatcher.submit({ rideId: "r3", riderId: "u3", pickupLat: 37.775, pickupLng: -122.4194 });
    await done;

    expect(unassigned).toEqual(["r3"]);
  });
});
