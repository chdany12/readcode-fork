import { AppError, wrap } from "./errors";

export interface Campaign { id: string; advertiserId: string; dailyBudgetMicros: number; }
export interface SpendRow { campaignId: string; day: string; spendMicros: number; impressions: number; }

export interface CampaignStore { get(id: string): Promise<Campaign | null>; }
export interface WarehouseClient { query<T>(sql: string, params: unknown[]): Promise<T[]>; }

export class SpendReportService {
  constructor(
    private readonly campaigns: CampaignStore,
    private readonly warehouse: WarehouseClient,
  ) {}

  async dailySpend(campaignId: string, from: string, to: string): Promise<SpendRow[]> {
    if (from > to) {
      throw new AppError("invalid_input", "from must not be after to", { from, to });
    }

    let campaign: Campaign | null;
    try {
      campaign = await this.campaigns.get(campaignId);
    } catch (err) {
      throw wrap(err, "loading campaign", { campaignId });
    }
    if (!campaign) {
      throw new AppError("not_found", `campaign ${campaignId} not found`, { campaignId });
    }

    try {
      return await this.warehouse.query<SpendRow>(
        `SELECT campaign_id AS "campaignId", day, spend_micros AS "spendMicros", impressions
         FROM daily_campaign_spend WHERE campaign_id = $1 AND day BETWEEN $2 AND $3 ORDER BY day`,
        [campaignId, from, to],
      );
    } catch (err) {
      throw new AppError("upstream_unavailable", "querying spend warehouse", { campaignId, from, to }, { cause: err });
    }
  }
}
