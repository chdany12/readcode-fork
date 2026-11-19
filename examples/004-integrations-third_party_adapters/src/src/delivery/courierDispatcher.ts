import { CourierRejectedError, CourierUnavailableError, DashlineCourierClient } from "./dashlineCourierClient";

export interface OrderRepo {
  markCourierBooked(orderId: string, externalId: string, trackingUrl: string, feeCents: number): Promise<void>;
  markNeedsManualDispatch(orderId: string, reason: string): Promise<void>;
}

export interface ReadyOrder {
  id: string;
  restaurantAddress: string;
  readyAt: Date;
  customerAddress: string;
  customerPhone: string;
  totalCents: number;
}

export class CourierDispatcher {
  constructor(private readonly courier: DashlineCourierClient, private readonly orders: OrderRepo) {}

  async dispatch(order: ReadyOrder): Promise<void> {
    try {
      const booking = await this.courier.createDelivery({
        orderId: order.id,
        pickup: { address: order.restaurantAddress, readyAt: order.readyAt },
        dropoff: { address: order.customerAddress, phone: order.customerPhone },
        orderValueCents: order.totalCents,
      });
      await this.orders.markCourierBooked(order.id, booking.externalId, booking.trackingUrl, booking.feeCents);
    } catch (err) {
      if (err instanceof CourierRejectedError) {
        await this.orders.markNeedsManualDispatch(order.id, `rejected: ${err.code}`);
        return;
      }
      if (err instanceof CourierUnavailableError) {
        await this.orders.markNeedsManualDispatch(order.id, "courier provider unavailable");
        return;
      }
      throw err;
    }
  }
}
