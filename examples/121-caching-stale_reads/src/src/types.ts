export type CampaignStatus = "active" | "paused" | "exhausted";

export interface CampaignState {
  campaignId: string;
  status: CampaignStatus;
  bidCpmMicros: number;
  dailyBudgetMicros: number;
  version: number;
}

export interface CampaignChangedEvent {
  type: "campaign.changed";
  state: CampaignState;
}

export interface CampaignSource {
  loadAll(): Promise<CampaignState[]>;
}
