import type { CampaignChangedEvent, CampaignSource, CampaignState } from "./types";

export interface Metrics {
  increment(name: string, tags?: Record<string, string>): void;
  gauge(name: string, value: number): void;
}

export class CampaignStateCache {
  private readonly entries = new Map<string, CampaignState>();
  private loadedAt = 0;

  constructor(
    private readonly source: CampaignSource,
    private readonly metrics: Metrics,
    private readonly now: () => number = Date.now,
  ) {}

  async warm(): Promise<void> {
    const all = await this.source.loadAll();
    for (const state of all) {
      this.apply(state, "snapshot");
    }
    this.loadedAt = this.now();
    this.metrics.gauge("campaign_cache.size", this.entries.size);
  }

  onEvent(evt: CampaignChangedEvent): void {
    this.apply(evt.state, "event");
  }

  private apply(incoming: CampaignState, origin: "snapshot" | "event"): void {
    const existing = this.entries.get(incoming.campaignId);
    if (existing && existing.version === incoming.version) {
      this.metrics.increment("campaign_cache.skipped", { origin });
      return;
    }
    this.entries.set(incoming.campaignId, incoming);
    this.metrics.increment("campaign_cache.applied", { origin });
  }

  isServable(campaignId: string): CampaignState | null {
    const state = this.entries.get(campaignId);
    if (!state || state.status !== "active") {
      return null;
    }
    return state;
  }

  snapshotAgeMs(): number {
    return this.loadedAt === 0 ? Infinity : this.now() - this.loadedAt;
  }
}
