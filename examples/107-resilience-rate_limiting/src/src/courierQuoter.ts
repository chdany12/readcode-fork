import { PacedExecutor, QueueFullError } from "./pacedExecutor";

export interface CourierQuoteRequest {
  orderId: string;
  restaurantId: string;
  dropoff: { lat: number; lng: number };
}

export interface CourierQuote {
  fee: number;
  etaMinutes: number;
}

export interface CourierApi {
  quote(req: CourierQuoteRequest, signal: AbortSignal): Promise<CourierQuote>;
}

const FALLBACK_QUOTE: CourierQuote = { fee: 499, etaMinutes: 45 };

export class CourierQuoter {
  private readonly pacer = new PacedExecutor(200, 50);

  constructor(private readonly api: CourierApi) {}

  async quote(req: CourierQuoteRequest): Promise<CourierQuote & { estimated: boolean }> {
    try {
      const q = await this.pacer.submit(() => this.callWithTimeout(req, 2_000));
      return { ...q, estimated: false };
    } catch (err) {
      if (err instanceof QueueFullError || (err as Error).name === "AbortError") {
        return { ...FALLBACK_QUOTE, estimated: true };
      }
      throw err;
    }
  }

  private async callWithTimeout(req: CourierQuoteRequest, ms: number) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await this.api.quote(req, ctrl.signal);
    } finally {
      clearTimeout(t);
    }
  }
}
