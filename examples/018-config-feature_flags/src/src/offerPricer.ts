import { FlagEvaluator, FlagContext } from "./flags";

export interface FareQuote {
  itineraryId: string;
  baseFare: number;
  taxes: number;
  currency: string;
}

export interface PricedOffer {
  itineraryId: string;
  total: number;
  currency: string;
  bundle: "standard" | "flex";
  pricingVersion: string;
}

export interface QuoteStore {
  save(sessionId: string, offers: PricedOffer[]): Promise<void>;
  load(sessionId: string): Promise<PricedOffer[] | null>;
}

const FLEX_SURCHARGE_RATE = 0.12;

export class OfferPricer {
  constructor(
    private readonly flags: FlagEvaluator,
    private readonly store: QuoteStore,
  ) {}

  async priceSearch(
    sessionId: string,
    ctx: FlagContext,
    quotes: FareQuote[],
  ): Promise<PricedOffer[]> {
    const useFlexBundles = this.flags.isEnabled("flex_bundle_pricing", ctx);
    const offers = quotes.map((q) => this.price(q, useFlexBundles));
    await this.store.save(sessionId, offers);
    return offers;
  }

  async confirmOffer(
    sessionId: string,
    ctx: FlagContext,
    itineraryId: string,
  ): Promise<PricedOffer> {
    const saved = await this.store.load(sessionId);
    const offer = saved?.find((o) => o.itineraryId === itineraryId);
    if (!offer) {
      throw new Error(`offer ${itineraryId} expired for session ${sessionId}`);
    }
    const stillFlex = this.flags.isEnabled("flex_bundle_pricing", ctx);
    if ((offer.bundle === "flex") !== stillFlex) {
      throw new Error(`pricing changed for ${itineraryId}, please search again`);
    }
    return offer;
  }

  private price(q: FareQuote, flex: boolean): PricedOffer {
    const base = q.baseFare + q.taxes;
    const total = flex ? Math.round(base * (1 + FLEX_SURCHARGE_RATE) * 100) / 100 : base;
    return {
      itineraryId: q.itineraryId,
      total,
      currency: q.currency,
      bundle: flex ? "flex" : "standard",
      pricingVersion: flex ? "flex-v1" : "std-v3",
    };
  }
}
