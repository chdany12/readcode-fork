import { ShipmentDispatcher } from "./dispatcher";
import { CarrierClient, Clock, LabelRequest, Shipment, ShipmentRepo } from "./types";

class FixedClock implements Clock {
  constructor(private iso: string) {}
  now() { return new Date(this.iso); }
}

class InMemoryShipmentRepo implements ShipmentRepo {
  private rows = new Map<string, Shipment>();
  seed(s: Shipment) { this.rows.set(s.id, { ...s }); }
  async get(id: string) { const r = this.rows.get(id); return r ? { ...r } : undefined; }
  async save(s: Shipment) { this.rows.set(s.id, { ...s }); }
}

class RecordingCarrier implements CarrierClient {
  readonly requests: LabelRequest[] = [];
  private seq = 0;
  async createLabel(req: LabelRequest) {
    this.requests.push(req);
    this.seq += 1;
    return { trackingNumber: `TRK-${this.seq}` };
  }
}

function setup(clockIso: string) {
  const carrier = new RecordingCarrier();
  const repo = new InMemoryShipmentRepo();
  repo.seed({ id: "sh_1", weightGrams: 1200, destinationPostcode: "94107" });
  const dispatcher = new ShipmentDispatcher(carrier, repo, new FixedClock(clockIso));
  return { carrier, repo, dispatcher };
}

describe("ShipmentDispatcher", () => {
  it("books same-day pickup before the cutoff", async () => {
    const { carrier, repo, dispatcher } = setup("2024-03-04T16:59:00Z");
    const result = await dispatcher.dispatch("sh_1");
    expect(result).toEqual({ status: "dispatched", trackingNumber: "TRK-1" });
    expect(carrier.requests).toHaveLength(1);
    expect(carrier.requests[0].pickupDate).toBe("2024-03-04");
    expect((await repo.get("sh_1"))?.trackingNumber).toBe("TRK-1");
  });

  it("rolls pickup to the next day at the cutoff", async () => {
    const { carrier, dispatcher } = setup("2024-03-31T17:00:00Z");
    await dispatcher.dispatch("sh_1");
    expect(carrier.requests[0].pickupDate).toBe("2024-04-01");
  });

  it("does not buy a second label for a dispatched shipment", async () => {
    const { carrier, dispatcher } = setup("2024-03-04T09:00:00Z");
    await dispatcher.dispatch("sh_1");
    const second = await dispatcher.dispatch("sh_1");
    expect(second).toEqual({ status: "already_dispatched", trackingNumber: "TRK-1" });
    expect(carrier.requests).toHaveLength(1);
  });

  it("returns not_found without calling the carrier", async () => {
    const { carrier, dispatcher } = setup("2024-03-04T09:00:00Z");
    expect(await dispatcher.dispatch("missing")).toEqual({ status: "not_found" });
    expect(carrier.requests).toHaveLength(0);
  });
});
