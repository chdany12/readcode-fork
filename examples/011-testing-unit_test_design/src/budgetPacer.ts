export interface CampaignBudget {
  campaignId: string;
  dailyBudgetMicros: number;
  spentTodayMicros: number;
}

export interface PacingDecision {
  allow: boolean;
  reason: "ok" | "exhausted" | "ahead_of_pace";
}

const MS_PER_DAY = 86_400_000;

export class BudgetPacer {
  constructor(
    private readonly now: () => Date,
    private readonly tolerance = 0.1,
  ) {}

  fractionOfDayElapsed(): number {
    const t = this.now();
    const startOfDay = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    return (t.getTime() - startOfDay) / MS_PER_DAY;
  }

  decide(budget: CampaignBudget, bidMicros: number): PacingDecision {
    if (budget.spentTodayMicros + bidMicros > budget.dailyBudgetMicros) {
      return { allow: false, reason: "exhausted" };
    }
    const target = budget.dailyBudgetMicros * this.fractionOfDayElapsed();
    const ceiling = target + budget.dailyBudgetMicros * this.tolerance;
    if (budget.spentTodayMicros > ceiling) {
      return { allow: false, reason: "ahead_of_pace" };
    }
    return { allow: true, reason: "ok" };
  }
}
