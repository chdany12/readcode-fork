export interface FareQuote {
  routeKey: string;
  baseFareCents: number;
  taxesCents: number;
  totalCents: number;
  currency: string;
  computedAt: number;
}

export interface FareSource {
  fetchBaseFare(origin: string, destination: string, date: string): Promise<{ cents: number; currency: string }>;
}

const QUOTE_TTL_MS = 60_000;
const TAX_RATE = 0.12;

export class PricingEngine {
  private readonly quotes = new Map<string, FareQuote>();

  constructor(private readonly source: FareSource, private readonly now: () => number = Date.now) {}

  async quote(origin: string, destination: string, date: string): Promise<FareQuote> {
    const routeKey = `${origin}:${destination}:${date}`;
    const cached = this.quotes.get(routeKey);
    if (cached && this.now() - cached.computedAt < QUOTE_TTL_MS) {
      return cached;
    }

    const base = await this.source.fetchBaseFare(origin, destination, date);
    const taxesCents = Math.round(base.cents * TAX_RATE);
    const fresh: FareQuote = {
      routeKey,
      baseFareCents: base.cents,
      taxesCents,
      totalCents: base.cents + taxesCents,
      currency: base.currency,
      computedAt: this.now(),
    };
    this.quotes.set(routeKey, fresh);
    return fresh;
  }

  invalidate(routeKey: string): void {
    this.quotes.delete(routeKey);
  }
}
