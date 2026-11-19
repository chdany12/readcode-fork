import { randomUUID } from "crypto";
import { Currency, JournalEntry, LedgerStore, Posting, assertBalanced } from "./ledger";

export interface FeeSchedule {
  basisPoints: number;
  minimumMinor: number;
}

export interface PartnerShare {
  accountId: string;
  weight: number;
}

export class InsufficientFundsError extends Error {}

export class WireTransferService {
  constructor(
    private readonly store: LedgerStore,
    private readonly fees: FeeSchedule,
    private readonly feePartners: PartnerShare[],
  ) {
    if (feePartners.length === 0) throw new Error("at least one fee partner required");
  }

  computeFee(amountMinor: number): number {
    const pct = Math.ceil((amountMinor * this.fees.basisPoints) / 10_000);
    return Math.max(pct, this.fees.minimumMinor);
  }

  splitFee(feeMinor: number): Posting[] {
    const totalWeight = this.feePartners.reduce((s, p) => s + p.weight, 0);
    return this.feePartners.map((p) => ({
      accountId: p.accountId,
      amountMinor: Math.floor((feeMinor * p.weight) / totalWeight),
      currency: "USD" as Currency,
    }));
  }

  async sendWire(params: {
    fromAccount: string;
    toAccount: string;
    amountMinor: number;
    currency: Currency;
    reference: string;
  }): Promise<JournalEntry> {
    const { fromAccount, toAccount, amountMinor, currency, reference } = params;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("amount must be a positive integer in minor units");
    }
    if (currency !== "USD") {
      throw new Error(`wires in ${currency} are not supported by this rail`);
    }

    const fee = this.computeFee(amountMinor);
    const available = await this.store.balanceOf(fromAccount, currency);
    if (available < amountMinor + fee) {
      throw new InsufficientFundsError(
        `account ${fromAccount} has ${available}, needs ${amountMinor + fee}`,
      );
    }

    const feePostings = this.splitFee(fee);
    const entry: JournalEntry = {
      id: randomUUID(),
      description: `wire ${reference}`,
      createdAt: new Date(),
      postings: [
        { accountId: fromAccount, amountMinor: -(amountMinor + fee), currency },
        { accountId: toAccount, amountMinor, currency },
        ...feePostings,
      ],
    };

    assertBalanced(entry);
    await this.store.append(entry);
    return entry;
  }
}
