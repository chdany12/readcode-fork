import { randomUUID } from "crypto";
import { LedgerLine, LedgerRepo, LedgerTxn, sumLines } from "./ledger";

const MICROS_PER_CENT = 10_000n;

export interface BuildUsage {
  orgId: string;
  buildId: string;
  runnerClass: "small" | "large" | "gpu";
  durationSeconds: number;
}

const RATE_MICROS_PER_MINUTE: Record<BuildUsage["runnerClass"], bigint> = {
  small: 8_000n,
  large: 32_000n,
  gpu: 700_000n,
};

export class BuildBilling {
  constructor(private readonly repo: LedgerRepo) {}

  priceMicros(usage: BuildUsage): bigint {
    const minutes = BigInt(Math.ceil(usage.durationSeconds / 60));
    return minutes * RATE_MICROS_PER_MINUTE[usage.runnerClass];
  }

  async chargeBuild(usage: BuildUsage): Promise<LedgerTxn> {
    const txnId = `build:${usage.buildId}`;
    const existing = await this.repo.getTxn(txnId);
    if (existing) return existing;

    const amount = this.priceMicros(usage);
    const txn: LedgerTxn = {
      txnId,
      orgId: usage.orgId,
      kind: "usage_charge",
      postedAt: new Date(),
      lines: [
        { account: "customer_receivable", orgId: usage.orgId, amountMicros: amount },
        { account: "compute_revenue", orgId: usage.orgId, amountMicros: -amount },
      ],
    };
    await this.post(txn);
    return txn;
  }

  async reverseCharge(originalTxnId: string, reason: string): Promise<LedgerTxn> {
    const original = await this.repo.getTxn(originalTxnId);
    if (!original) throw new Error(`txn ${originalTxnId} not found`);
    if (original.kind !== "usage_charge") {
      throw new Error(`only usage charges can be reversed, got ${original.kind}`);
    }
    const prior = await this.repo.findReversalOf(originalTxnId);
    if (prior) return prior;

    const lines: LedgerLine[] = original.lines.map((l) => ({
      account: l.account === "customer_receivable" ? "refunds_payable" : l.account,
      orgId: l.orgId,
      amountMicros: l.amountMicros,
    }));

    const reversal: LedgerTxn = {
      txnId: `rev:${originalTxnId}:${randomUUID()}`,
      orgId: original.orgId,
      kind: "reversal",
      reversesTxnId: originalTxnId,
      postedAt: new Date(),
      lines,
    };
    console.info("reversing build charge", { originalTxnId, reason });
    await this.post(reversal);
    return reversal;
  }

  invoiceCents(totalMicros: bigint): bigint {
    return (totalMicros + MICROS_PER_CENT - 1n) / MICROS_PER_CENT;
  }

  private async post(txn: LedgerTxn): Promise<void> {
    if (sumLines(txn.lines) !== 0n) {
      throw new Error(`txn ${txn.txnId} does not balance`);
    }
    await this.repo.insert(txn);
  }
}
