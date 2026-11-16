import { SpendStore } from "./spendStore";

export interface Campaign {
  id: string;
  dailyBudgetMicros: number;
  bidMicros: number;
  active: boolean;
}

export interface CampaignLookup {
  get(campaignId: string): Promise<Campaign | null>;
}

export type ChargeResult =
  | { ok: true; remainingMicros: number }
  | { ok: false; reason: "inactive" | "budget_exhausted" | "unknown_campaign" };

function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export class BudgetPacer {
  constructor(
    private readonly campaigns: CampaignLookup,
    private readonly spend: SpendStore,
    private readonly now: () => number = Date.now,
  ) {}

  async chargeImpression(campaignId: string): Promise<ChargeResult> {
    const campaign = await this.campaigns.get(campaignId);
    if (!campaign) return { ok: false, reason: "unknown_campaign" };
    if (!campaign.active) return { ok: false, reason: "inactive" };

    const day = utcDay(this.now());
    const spent = await this.spend.getSpentMicros(campaign.id, day);
    const next = spent + campaign.bidMicros;
    if (next > campaign.dailyBudgetMicros) {
      return { ok: false, reason: "budget_exhausted" };
    }

    await this.spend.setSpentMicros(campaign.id, day, next);
    return { ok: true, remainingMicros: campaign.dailyBudgetMicros - next };
  }
}
