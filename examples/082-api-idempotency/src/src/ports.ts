export type KeyState =
  | { kind: "in_progress"; fingerprint: string; lockedUntil: number }
  | { kind: "completed"; fingerprint: string; status: number; body: unknown };

export interface IdempotencyRepo {
  tryReserve(scope: string, fingerprint: string, lockMs: number): Promise<boolean>;
  get(scope: string): Promise<KeyState | null>;
  complete(scope: string, status: number, body: unknown): Promise<void>;
  release(scope: string): Promise<void>;
}

export class GatewayUnavailableError extends Error {}
export class CardDeclinedError extends Error {
  constructor(public readonly declineCode: string) {
    super(`declined: ${declineCode}`);
  }
}

export interface PaymentGateway {
  refund(chargeId: string, amountCents: number, reference: string): Promise<{ refundId: string }>;
}

export interface ChargeRepo {
  findForMerchant(merchantId: string, chargeId: string): Promise<{ id: string; amountCents: number; refundedCents: number } | null>;
  addRefund(chargeId: string, refundId: string, amountCents: number): Promise<void>;
}
