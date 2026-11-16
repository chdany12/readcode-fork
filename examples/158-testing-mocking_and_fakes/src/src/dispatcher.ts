import { Clock, CarrierClient, ShipmentRepo, Shipment, DispatchResult } from "./types";

export class ShipmentDispatcher {
  constructor(
    private readonly carrier: CarrierClient,
    private readonly repo: ShipmentRepo,
    private readonly clock: Clock,
    private readonly cutoffHourUtc = 17,
  ) {}

  async dispatch(shipmentId: string): Promise<DispatchResult> {
    const shipment = await this.repo.get(shipmentId);
    if (!shipment) return { status: "not_found" };
    if (shipment.trackingNumber) {
      return { status: "already_dispatched", trackingNumber: shipment.trackingNumber };
    }

    const now = this.clock.now();
    const pickupDate = this.pickupDateFor(now);

    const label = await this.carrier.createLabel({
      reference: shipment.id,
      weightGrams: shipment.weightGrams,
      destinationPostcode: shipment.destinationPostcode,
      pickupDate,
    });

    const updated: Shipment = {
      ...shipment,
      trackingNumber: label.trackingNumber,
      pickupDate,
      dispatchedAt: now.toISOString(),
    };
    await this.repo.save(updated);
    return { status: "dispatched", trackingNumber: label.trackingNumber };
  }

  private pickupDateFor(now: Date): string {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (now.getUTCHours() >= this.cutoffHourUtc) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}
