import { CartSummary, DeliveryQuote, DeliveryQuoteProvider } from "./quote";

export class QuoteSelector {
  constructor(
    private readonly providers: readonly DeliveryQuoteProvider[],
    private readonly log: (event: Record<string, unknown>) => void,
  ) {}

  async best(cart: CartSummary): Promise<DeliveryQuote | null> {
    const settled = await Promise.allSettled(this.providers.map((p) => p.quote(cart)));
    const quotes: DeliveryQuote[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        if (r.value !== null) quotes.push(r.value);
      } else {
        this.log({ msg: "quote provider failed", provider: this.providers[i].name, error: String(r.reason) });
      }
    });
    if (quotes.length === 0) {
      return null;
    }
    return quotes.reduce((a, b) =>
      b.feeCents < a.feeCents || (b.feeCents === a.feeCents && b.etaMinutes < a.etaMinutes) ? b : a,
    );
  }
}
