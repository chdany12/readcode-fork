export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<"OK">;
  del(key: string): Promise<number>;
}

export interface FareQuote {
  routeKey: string;
  carrier: string;
  cabin: "economy" | "premium" | "business";
  totalMinor: number;
  currency: string;
  quotedAt: number;
  validUntil: number;
}

export interface FareSupplier {
  quote(origin: string, dest: string, date: string, cabin: FareQuote["cabin"]): Promise<FareQuote>;
}
