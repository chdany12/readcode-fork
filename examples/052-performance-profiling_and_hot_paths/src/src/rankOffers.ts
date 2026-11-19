export interface FareOffer {
  offerId: string;
  carrier: string;
  priceCents: number;
  durationMinutes: number;
  stops: number;
  departsAt: number;
}

export interface RankedOffer extends FareOffer {
  score: number;
  badges: string[];
}

const WEIGHTS = { price: 0.6, duration: 0.3, stops: 0.1 };

export function rankOffers(offers: FareOffer[], preferredCarriers: Set<string>): RankedOffer[] {
  if (offers.length === 0) return [];
  const fastest = offers.reduce((m, o) => Math.min(m, o.durationMinutes), Infinity);

  const ranked = offers.map((o) => {
    const cheapest = Math.min(...offers.map((x) => x.priceCents));
    const priceRatio = o.priceCents / cheapest;
    const durationRatio = o.durationMinutes / fastest;
    let score = WEIGHTS.price * priceRatio + WEIGHTS.duration * durationRatio + WEIGHTS.stops * o.stops;
    if (preferredCarriers.has(o.carrier)) score *= 0.95;

    const badges: string[] = [];
    if (o.priceCents === cheapest) badges.push("cheapest");
    if (o.durationMinutes === fastest) badges.push("fastest");
    if (o.stops === 0) badges.push("nonstop");
    return { ...o, score, badges };
  });

  ranked.sort((a, b) => a.score - b.score || a.departsAt - b.departsAt);
  return ranked;
}
