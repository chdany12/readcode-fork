import { CartSummary, DeliveryQuote, DeliveryQuoteProvider } from "./quote";

export interface FlatRateConfig {
  baseFeeDollars: number;
  perKmCents: number;
  maxDistanceKm: number;
  freeDeliveryOverCents: number;
  prepMinutes: number;
  kmPerMinute: number;
}

export class FlatRateProvider implements DeliveryQuoteProvider {
  readonly name = "in_house";

  constructor(private readonly cfg: FlatRateConfig, private readonly now: () => Date) {}

  async quote(cart: CartSummary): Promise<DeliveryQuote | null> {
    if (cart.distanceKm > this.cfg.maxDistanceKm) {
      return null;
    }
    const feeCents =
      cart.subtotalCents >= this.cfg.freeDeliveryOverCents
        ? 0
        : this.cfg.baseFeeDollars + Math.ceil(cart.distanceKm * this.cfg.perKmCents);
    const etaMinutes = this.cfg.prepMinutes + Math.ceil(cart.distanceKm / this.cfg.kmPerMinute);
    return {
      provider: this.name,
      feeCents,
      etaMinutes,
      expiresAt: new Date(this.now().getTime() + 5 * 60_000),
    };
  }
}

interface CourierApiResponse {
  available: boolean;
  fee: { amount: number; currency: string };
  pickup_eta_min: number;
  dropoff_eta_min: number;
  valid_until: string;
}

export class CourierNetworkProvider implements DeliveryQuoteProvider {
  readonly name = "courier_network";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async quote(cart: CartSummary): Promise<DeliveryQuote | null> {
    const res = await fetch(`${this.baseUrl}/v2/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ restaurant_id: cart.restaurantId, distance_km: cart.distanceKm }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`courier quote failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as CourierApiResponse;
    if (!body.available || body.fee.currency !== "USD") {
      return null;
    }
    return {
      provider: this.name,
      feeCents: body.fee.amount,
      etaMinutes: body.dropoff_eta_min,
      expiresAt: new Date(body.valid_until),
    };
  }
}
