export interface PickupRequest {
  reference: string;
  warehouseId: string;
  carrierCode: string;
  totalWeightGrams: number;
}

export interface PickupBooking {
  trackingNumber: string;
  pickupWindow: string;
}

export class Carrier {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async bookPickup(req: PickupRequest): Promise<PickupBooking> {
    const res = await fetch(`${this.baseUrl}/pickups`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
        "idempotency-key": `pickup-${req.reference}`,
      },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`carrier ${req.carrierCode} returned ${res.status}`);
    }
    return (await res.json()) as PickupBooking;
  }
}
