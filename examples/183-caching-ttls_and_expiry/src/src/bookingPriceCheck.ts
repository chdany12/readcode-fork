import { FareQuoteCache } from "./fareQuoteCache";
import { FareQuote } from "./types";

export interface PriceCheckResult {
  ok: boolean;
  quote: FareQuote;
  reason?: string;
}

export class BookingPriceCheck {
  constructor(private readonly cache: FareQuoteCache) {}

  async confirmPrice(
    origin: string,
    dest: string,
    date: string,
    cabin: FareQuote["cabin"],
    displayedMinor: number,
  ): Promise<PriceCheckResult> {
    const quote = await this.cache.getQuote(origin, dest, date, cabin);
    if (quote.totalMinor !== displayedMinor) {
      return { ok: false, quote, reason: "PRICE_CHANGED" };
    }
    return { ok: true, quote };
  }
}
