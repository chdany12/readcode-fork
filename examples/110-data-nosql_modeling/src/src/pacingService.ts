import { CampaignCounterStore } from "./campaignCounterStore";

export interface PacingResult {
  campaignId: string;
  day: string;
  spentMicros: number;
  budgetMicros: number;
  ctr: number;
  shouldThrottle: boolean;
}

export class PacingService {
  constructor(
    private readonly counters: CampaignCounterStore,
    private readonly throttleAt = 0.95,
  ) {}

  async evaluate(campaignId: string, budgetMicros: number, now = new Date()): Promise<PacingResult> {
    const day = now.toISOString().slice(0, 10);
    const t = await this.counters.dailyTotals(campaignId, day);
    const ctr = t.impressions > 0 ? t.clicks / t.impressions : 0;
    return {
      campaignId,
      day,
      spentMicros: t.spendMicros,
      budgetMicros,
      ctr,
      shouldThrottle: t.spendMicros >= budgetMicros * this.throttleAt,
    };
  }
}
