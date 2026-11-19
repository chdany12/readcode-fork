import { TransientBankError } from "./types";

export interface TransferRequest {
  amountCents: number;
  currency: string;
  destinationToken: string;
  reference: string;
  idempotencyKey: string;
}

export class BankClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async createTransfer(req: TransferRequest): Promise<{ transferId: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.baseUrl}/v2/transfers`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": req.idempotencyKey,
        },
        body: JSON.stringify({
          amount: req.amountCents,
          currency: req.currency,
          destination: req.destinationToken,
          reference: req.reference,
        }),
      });
      if (res.status >= 500 || res.status === 429) {
        throw new TransientBankError(`bank returned ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(`transfer rejected: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as { id: string };
      return { transferId: data.id };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new TransientBankError("bank request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
