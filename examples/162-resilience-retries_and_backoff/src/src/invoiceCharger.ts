import { randomUUID } from "node:crypto";
import { Backoff, DEFAULT_BACKOFF, delayFor, sleep } from "./backoff";

export interface ChargeRequest {
  invoiceId: string;
  customerId: string;
  paymentMethodId: string;
  amountMinor: number;
  currency: string;
}

export type ChargeOutcome =
  | { kind: "succeeded"; chargeId: string }
  | { kind: "declined"; code: string }
  | { kind: "unavailable"; attempts: number };

interface GatewayResponse { status: number; body: any }

export interface GatewayTransport {
  post(path: string, body: unknown, headers: Record<string, string>): Promise<GatewayResponse>;
}

export class InvoiceCharger {
  constructor(
    private readonly gateway: GatewayTransport,
    private readonly backoff: Backoff = DEFAULT_BACKOFF,
  ) {}

  async charge(req: ChargeRequest): Promise<ChargeOutcome> {
    let attempt = 0;
    while (true) {
      attempt++;
      let res: GatewayResponse | undefined;
      try {
        const idempotencyKey = randomUUID();
        res = await this.gateway.post(
          "/charges",
          {
            amount: req.amountMinor,
            currency: req.currency,
            customer: req.customerId,
            payment_method: req.paymentMethodId,
            metadata: { invoice_id: req.invoiceId },
          },
          { "Idempotency-Key": idempotencyKey },
        );
      } catch {
        res = undefined;
      }

      if (res && res.status >= 200 && res.status < 300) {
        return { kind: "succeeded", chargeId: res.body.id };
      }
      if (res && res.status === 402) {
        return { kind: "declined", code: res.body.decline_code ?? "generic_decline" };
      }
      if (res && res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`charge for invoice ${req.invoiceId} rejected: ${res.status}`);
      }

      if (attempt > this.backoff.maxRetries) {
        return { kind: "unavailable", attempts: attempt };
      }
      await sleep(delayFor(attempt - 1, this.backoff));
    }
  }
}
