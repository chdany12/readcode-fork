import Redis from "ioredis";
import { Carrier } from "./carrier";

export interface QueueMessage {
  id: string;
  body: string;
  receiveCount: number;
  ack(): Promise<void>;
  release(delaySeconds: number): Promise<void>;
}

interface ShipmentDispatched {
  shipmentId: string;
  warehouseId: string;
  carrierCode: string;
  parcels: { weightGrams: number; sku: string }[];
}

const MAX_ATTEMPTS = 6;

export class DispatchHandler {
  constructor(private readonly redis: Redis, private readonly carrier: Carrier) {}

  async handle(msg: QueueMessage): Promise<void> {
    const evt: ShipmentDispatched = JSON.parse(msg.body);
    const key = `dispatch:booked:${evt.shipmentId}`;

    const fresh = await this.redis.set(key, msg.id, "EX", 7 * 24 * 3600, "NX");
    if (fresh === null) {
      await msg.ack();
      return;
    }

    try {
      const booking = await this.carrier.bookPickup({
        reference: evt.shipmentId,
        warehouseId: evt.warehouseId,
        carrierCode: evt.carrierCode,
        totalWeightGrams: evt.parcels.reduce((s, p) => s + p.weightGrams, 0),
      });
      await this.redis.hset(`shipment:${evt.shipmentId}`, {
        trackingNumber: booking.trackingNumber,
        pickupWindow: booking.pickupWindow,
      });
      await msg.ack();
    } catch (err) {
      if (msg.receiveCount >= MAX_ATTEMPTS) {
        console.error("dispatch booking exhausted retries", { shipmentId: evt.shipmentId, err: String(err) });
        throw err;
      }
      const delay = Math.min(300, 2 ** msg.receiveCount * 5);
      await msg.release(delay);
    }
  }
}
