export interface CartSummary {
  restaurantId: string;
  subtotalCents: number;
  itemCount: number;
  distanceKm: number;
}

export interface DeliveryQuote {
  provider: string;
  feeCents: number;
  etaMinutes: number;
  expiresAt: Date;
}

export interface DeliveryQuoteProvider {
  readonly name: string;
  quote(cart: CartSummary): Promise<DeliveryQuote | null>;
}
