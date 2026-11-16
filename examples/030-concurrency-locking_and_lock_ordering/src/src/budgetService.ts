import { KeyedMutex } from "./keyedMutex";

export interface CampaignBudget {
  campaignId: string;
  remainingMicros: bigint;
  spentMicros: bigint;
  version: number;
}

export interface BudgetRepo {
  get(campaignId: string): Promise<CampaignBudget>;
  save(budget: CampaignBudget): Promise<void>;
}

export class InsufficientBudgetError extends Error {
  constructor(readonly campaignId: string, readonly requestedMicros: bigint) {
    super(`campaign ${campaignId} cannot cover ${requestedMicros} micros`);
  }
}

export class BudgetService {
  private readonly mutex = new KeyedMutex();

  constructor(private readonly repo: BudgetRepo) {}

  async chargeImpression(campaignId: string, costMicros: bigint): Promise<boolean> {
    if (costMicros <= 0n) throw new RangeError("cost must be positive");
    return this.mutex.runExclusive([campaignId], async () => {
      const b = await this.repo.get(campaignId);
      if (b.remainingMicros < costMicros) return false;
      await this.repo.save({
        ...b,
        remainingMicros: b.remainingMicros - costMicros,
        spentMicros: b.spentMicros + costMicros,
        version: b.version + 1,
      });
      return true;
    });
  }

  async reallocate(fromId: string, toId: string, amountMicros: bigint): Promise<void> {
    if (fromId === toId) throw new RangeError("source and destination must differ");
    if (amountMicros <= 0n) throw new RangeError("amount must be positive");

    await this.mutex.runExclusive([fromId, toId], async () => {
      const from = await this.repo.get(fromId);
      const to = await this.repo.get(toId);
      if (from.remainingMicros < amountMicros) {
        throw new InsufficientBudgetError(fromId, amountMicros);
      }
      await this.repo.save({ ...from, remainingMicros: from.remainingMicros - amountMicros, version: from.version + 1 });
      await this.repo.save({ ...to, remainingMicros: to.remainingMicros + amountMicros, version: to.version + 1 });
    });
  }

  async rebalance(campaignIds: string[], targetEachMicros: bigint): Promise<bigint> {
    return this.mutex.runExclusive(campaignIds, async () => {
      const budgets = await Promise.all(
        Array.from(new Set(campaignIds)).map((id) => this.repo.get(id)),
      );
      let pool = 0n;
      for (const b of budgets) pool += b.remainingMicros;

      const needed = targetEachMicros * BigInt(budgets.length);
      if (pool < needed) throw new InsufficientBudgetError(campaignIds.join(","), needed);

      for (const b of budgets) {
        await this.repo.save({ ...b, remainingMicros: targetEachMicros, version: b.version + 1 });
      }
      return pool - needed;
    });
  }
}
