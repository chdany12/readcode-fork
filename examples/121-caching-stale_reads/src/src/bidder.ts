import type { CampaignStateCache } from "./campaignCache";

export interface BidRequest {
  requestId: string;
  candidateCampaignIds: string[];
  floorCpmMicros: number;
}

export interface Bid {
  requestId: string;
  campaignId: string;
  cpmMicros: number;
}

const MAX_SNAPSHOT_AGE_MS = 10 * 60 * 1000;

export class Bidder {
  constructor(private readonly cache: CampaignStateCache) {}

  bid(req: BidRequest): Bid | null {
    if (this.cache.snapshotAgeMs() > MAX_SNAPSHOT_AGE_MS) {
      return null;
    }
    let best: Bid | null = null;
    for (const id of req.candidateCampaignIds) {
      const state = this.cache.isServable(id);
      if (!state || state.bidCpmMicros < req.floorCpmMicros) {
        continue;
      }
      if (!best || state.bidCpmMicros > best.cpmMicros) {
        best = { requestId: req.requestId, campaignId: id, cpmMicros: state.bidCpmMicros };
      }
    }
    return best;
  }
}
