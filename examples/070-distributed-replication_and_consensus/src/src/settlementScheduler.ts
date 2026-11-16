import { LeaderLease } from "./leaderLease";

export interface SettlementBatch {
  id: string;
  merchantId: string;
  totalCents: number;
}

export interface LedgerClient {
  pendingBatches(limit: number): Promise<SettlementBatch[]>;
  settle(batchId: string, fencingToken: number): Promise<"settled" | "stale_token" | "already_settled">;
}

export class SettlementScheduler {
  constructor(private readonly lease: LeaderLease, private readonly ledger: LedgerClient) {}

  async runOnce(): Promise<number> {
    if (!this.lease.isLeader()) return 0;
    const token = this.lease.token();
    const batches = await this.ledger.pendingBatches(50);
    let settled = 0;
    for (const batch of batches) {
      if (!this.lease.isLeader()) break;
      const outcome = await this.ledger.settle(batch.id, token);
      if (outcome === "stale_token") {
        console.warn("lost leadership mid-run", { batchId: batch.id, token });
        break;
      }
      if (outcome === "settled") settled += 1;
    }
    return settled;
  }
}
