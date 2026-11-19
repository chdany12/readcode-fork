import { createHash } from "crypto";
import {
  CardDeclinedError,
  ChargeRepo,
  GatewayUnavailableError,
  IdempotencyRepo,
  PaymentGateway,
} from "./ports";

export interface RefundResult {
  status: number;
  body: unknown;
}

const LOCK_MS = 30_000;

export class RefundService {
  constructor(
    private readonly idem: IdempotencyRepo,
    private readonly charges: ChargeRepo,
    private readonly gateway: PaymentGateway
  ) {}

  async refund(merchantId: string, key: string, chargeId: string, amountCents: number): Promise<RefundResult> {
    const scope = `${merchantId}:${key}`;
    const fingerprint = createHash("sha256").update(`${chargeId}|${amountCents}`).digest("hex");

    const reserved = await this.idem.tryReserve(scope, fingerprint, LOCK_MS);
    if (!reserved) {
      const state = await this.idem.get(scope);
      if (!state || state.fingerprint !== fingerprint) {
        return { status: 422, body: { error: "idempotency_key_mismatch" } };
      }
      if (state.kind === "in_progress") {
        return { status: 409, body: { error: "request_in_progress" } };
      }
      return { status: state.status, body: state.body };
    }

    const result = await this.execute(merchantId, scope, chargeId, amountCents);
    await this.idem.complete(scope, result.status, result.body);
    return result;
  }

  private async execute(merchantId: string, scope: string, chargeId: string, amountCents: number): Promise<RefundResult> {
    const charge = await this.charges.findForMerchant(merchantId, chargeId);
    if (!charge) {
      return { status: 404, body: { error: "charge_not_found" } };
    }
    if (amountCents <= 0 || charge.refundedCents + amountCents > charge.amountCents) {
      return { status: 422, body: { error: "invalid_refund_amount" } };
    }
    try {
      const { refundId } = await this.gateway.refund(chargeId, amountCents, scope);
      await this.charges.addRefund(chargeId, refundId, amountCents);
      return { status: 201, body: { refundId, chargeId, amountCents } };
    } catch (err) {
      if (err instanceof CardDeclinedError) {
        return { status: 402, body: { error: "refund_declined", code: err.declineCode } };
      }
      if (err instanceof GatewayUnavailableError) {
        return { status: 503, body: { error: "gateway_unavailable", retryable: true } };
      }
      await this.idem.release(scope);
      throw err;
    }
  }
}
