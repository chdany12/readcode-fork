import { BillingAuditWriter } from "./auditWriter";

export interface PaymentGateway {
  refund(chargeId: string, amountCents: number, idempotencyKey: string): Promise<{ refundId: string }>;
}

export interface ChargeLookup {
  get(chargeId: string): Promise<{ accountId: string; amountCents: number; refundedCents: number; currency: string } | null>;
}

export class RefundService {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly charges: ChargeLookup,
    private readonly audit: BillingAuditWriter,
  ) {}

  async issueRefund(operatorId: string, chargeId: string, amountCents: number, requestKey: string) {
    const charge = await this.charges.get(chargeId);
    if (!charge) throw new Error(`charge ${chargeId} not found`);
    if (amountCents > charge.amountCents - charge.refundedCents) {
      throw new Error("refund exceeds remaining balance");
    }
    const { refundId } = await this.gateway.refund(chargeId, amountCents, requestKey);
    await this.audit.record({
      operatorId,
      operation: "refund.issued",
      accountId: charge.accountId,
      amountCents,
      currency: charge.currency,
    });
    return { refundId };
  }
}
