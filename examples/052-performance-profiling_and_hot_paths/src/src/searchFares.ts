import { performance } from "perf_hooks";
import { FareOffer, rankOffers } from "./rankOffers";

export interface SupplierClient {
  search(origin: string, dest: string, date: string, signal: AbortSignal): Promise<FareOffer[]>;
}

export interface Metrics {
  timing(name: string, ms: number, tags?: Record<string, string>): void;
  count(name: string, n: number, tags?: Record<string, string>): void;
}

export async function searchFares(
  suppliers: Record<string, SupplierClient>,
  metrics: Metrics,
  req: { origin: string; dest: string; date: string; preferred: string[]; limit: number }
) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  const results = await Promise.allSettled(
    Object.entries(suppliers).map(async ([name, client]) => {
      const t0 = performance.now();
      try {
        return await client.search(req.origin, req.dest, req.date, controller.signal);
      } finally {
        metrics.timing("fares.supplier_ms", performance.now() - t0, { supplier: name });
      }
    })
  );
  clearTimeout(timer);

  const offers: FareOffer[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") offers.push(...r.value);
  }
  metrics.count("fares.offers", offers.length);

  const t1 = performance.now();
  const ranked = rankOffers(offers, new Set(req.preferred));
  metrics.timing("fares.rank_ms", performance.now() - t1);

  metrics.timing("fares.total_ms", performance.now() - started);
  return {
    total: ranked.length,
    partial: results.some((r) => r.status === "rejected"),
    items: ranked.slice(0, req.limit),
  };
}
