import { createHmac, randomUUID } from "node:crypto";
import { PayoutConfig } from "./payoutConfig";
import { logger } from "./logger";

export interface DriverPayout {
  driverId: string;
  weekEnding: string;
  amountCents: number;
  currency: string;
}

export class DriverPayoutClient {
  constructor(private readonly config: PayoutConfig) {
    logger.info({ payoutConfig: config }, "payout client initialised");
  }

  async submit(payout: DriverPayout): Promise<string> {
    const body = JSON.stringify(payout);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", this.config.signingSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const requestId = randomUUID();
    const res = await fetch(`${this.config.baseUrl}/v2/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "X-Idempotency-Key": `${payout.driverId}:${payout.weekEnding}`,
        "X-Signature": `t=${timestamp},v1=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!res.ok) {
      logger.error(
        { driverId: payout.driverId, weekEnding: payout.weekEnding, status: res.status, requestId },
        "driver payout rejected",
      );
      throw new Error(`payout rejected with HTTP ${res.status}`);
    }
    const { payoutId } = (await res.json()) as { payoutId: string };
    logger.info({ driverId: payout.driverId, payoutId, requestId }, "driver payout submitted");
    return payoutId;
  }
}
