import { Currency, SCHEDULES, processingFee } from "./fees";

export interface Merchant {
  id: string;
  plan: keyof typeof SCHEDULES;
  currency: Currency;
}

export interface LedgerEntry {
  merchantId: string;
  kind: "charge" | "refund";
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
  reference: string;
}

export interface Ledger {
  append(entry: LedgerEntry): Promise<void>;
  findCharge(reference: string): Promise<LedgerEntry | null>;
}

export class SettlementService {
  constructor(private readonly ledger: Ledger) {}

  async recordCharge(m: Merchant, amountMinor: number, reference: string): Promise<LedgerEntry> {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new Error(`invalid charge amount ${amountMinor}`);
    }
    const feeMinor = processingFee(amountMinor, SCHEDULES[m.plan]);
    const entry: LedgerEntry = {
      merchantId: m.id,
      kind: "charge",
      grossMinor: amountMinor,
      feeMinor,
      netMinor: amountMinor - feeMinor,
      reference,
    };
    await this.ledger.append(entry);
    return entry;
  }

  async recordRefund(
    m: Merchant,
    chargeReference: string,
    refundMinor: number,
    reference: string,
  ): Promise<LedgerEntry> {
    const charge = await this.ledger.findCharge(chargeReference);
    if (!charge || charge.merchantId !== m.id) {
      throw new Error(`charge ${chargeReference} not found for merchant ${m.id}`);
    }
    if (!Number.isInteger(refundMinor) || refundMinor <= 0 || refundMinor > charge.grossMinor) {
      throw new Error(`invalid refund amount ${refundMinor}`);
    }
    const schedule = SCHEDULES[m.plan];
    const pct = Math.round((refundMinor * schedule.percentBps) / 10_000);
    const feeReturned = refundMinor === charge.grossMinor ? charge.feeMinor : pct;
    const entry: LedgerEntry = {
      merchantId: m.id,
      kind: "refund",
      grossMinor: -refundMinor,
      feeMinor: -feeReturned,
      netMinor: -(refundMinor - feeReturned),
      reference,
    };
    await this.ledger.append(entry);
    return entry;
  }
}
