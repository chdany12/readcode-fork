import { Counter, Histogram } from "./metrics";

export interface Courier {
  id: string;
  zone: string;
  vehicle: "bike" | "scooter" | "car";
}

export interface DeliveryLeg {
  orderId: string;
  courier: Courier;
  pickedUpAt: number;
  deliveredAt?: number;
  failedReason?: "customer_unreachable" | "address_invalid" | "courier_cancelled";
}

export interface LegRepository {
  load(orderId: string): Promise<DeliveryLeg | null>;
  save(leg: DeliveryLeg): Promise<void>;
}

const deliveryDuration = new Histogram("delivery_leg_minutes", [5, 10, 15, 20, 30, 45, 60, 90]);
const deliveryResults = new Counter("delivery_leg_results_total");

export class DeliveryTracker {
  constructor(private readonly repo: LegRepository, private readonly now: () => number = Date.now) {}

  async markDelivered(orderId: string): Promise<void> {
    const leg = await this.requireOpenLeg(orderId);
    leg.deliveredAt = this.now();
    await this.repo.save(leg);

    const minutes = (leg.deliveredAt - leg.pickedUpAt) / 60_000;
    deliveryDuration.observe(
      { zone: leg.courier.zone, vehicle: leg.courier.vehicle, courier: leg.courier.id },
      minutes,
    );
    deliveryResults.inc({ zone: leg.courier.zone, result: "delivered" });
  }

  async markFailed(orderId: string, reason: NonNullable<DeliveryLeg["failedReason"]>): Promise<void> {
    const leg = await this.requireOpenLeg(orderId);
    leg.failedReason = reason;
    await this.repo.save(leg);
    deliveryResults.inc({ zone: leg.courier.zone, result: reason });
  }

  private async requireOpenLeg(orderId: string): Promise<DeliveryLeg> {
    const leg = await this.repo.load(orderId);
    if (!leg) {
      throw new Error(`delivery leg not found for order ${orderId}`);
    }
    if (leg.deliveredAt !== undefined || leg.failedReason !== undefined) {
      throw new Error(`delivery leg for order ${orderId} is already closed`);
    }
    return leg;
  }
}
