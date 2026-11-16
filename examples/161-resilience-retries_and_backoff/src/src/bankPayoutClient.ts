import { randomUUID } from "node:crypto";
import { HttpError, withRetry } from "./retry";

export interface PayoutInstruction {
  employeeId: string;
  payrollRunId: string;
  amountCents: number;
  currency: string;
  bankAccountToken: string;
}

export interface PayoutReceipt { payoutId: string; status: "accepted" | "duplicate" }

export class BankPayoutClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async submit(instr: PayoutInstruction): Promise<PayoutReceipt> {
    const idempotencyKey = `payroll:${instr.payrollRunId}:${instr.employeeId}:${randomUUID()}`;

    return withRetry(
      async () => {
        const res = await fetch(`${this.baseUrl}/v2/payouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(instr),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 409) {
          const body = (await res.json()) as { payoutId: string };
          return { payoutId: body.payoutId, status: "duplicate" as const };
        }
        if (!res.ok) {
          const ra = res.headers.get("retry-after");
          const retryAfterMs = ra && /^\d+$/.test(ra) ? Number(ra) * 1000 : undefined;
          throw new HttpError(res.status, retryAfterMs, `payout ${instr.employeeId} rejected`);
        }
        const body = (await res.json()) as { payoutId: string };
        return { payoutId: body.payoutId, status: "accepted" as const };
      },
      { maxAttempts: 5, baseDelayMs: 250, maxDelayMs: 8_000 },
    );
  }
}
