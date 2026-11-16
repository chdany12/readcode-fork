export interface FraudScore {
  value: number;
  modelVersion: string;
}

export interface ScoreInput {
  amountCents: number;
  currency: string;
  card: string;
}

export class FraudScoringClient {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async score(input: ScoreInput, signal: AbortSignal): Promise<FraudScore> {
    const res = await fetch(`${this.endpoint}/v2/score`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(input),
      signal,
    });
    if (res.status >= 500) {
      throw new Error(`fraud scoring unavailable: ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(`fraud scoring rejected request: ${res.status}`);
    }
    return (await res.json()) as FraudScore;
  }
}
