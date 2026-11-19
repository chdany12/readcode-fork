export interface SpendStore {
  getSpentMicros(campaignId: string, day: string): Promise<number>;
  setSpentMicros(campaignId: string, day: string, value: number): Promise<void>;
}

export class RedisSpendStore implements SpendStore {
  constructor(private readonly redis: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  }) {}

  private key(campaignId: string, day: string): string {
    return `spend:${campaignId}:${day}`;
  }

  async getSpentMicros(campaignId: string, day: string): Promise<number> {
    const raw = await this.redis.get(this.key(campaignId, day));
    return raw === null ? 0 : Number(raw);
  }

  async setSpentMicros(campaignId: string, day: string, value: number): Promise<void> {
    await this.redis.set(this.key(campaignId, day), String(value), "EX", 60 * 60 * 48);
  }
}
