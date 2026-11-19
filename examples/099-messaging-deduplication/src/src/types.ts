export interface ClickEvent {
  clickId: string;
  campaignId: string;
  advertiserId: string;
  costMicros: number;
  occurredAt: string;
}

export interface QueueMessage {
  body: string;
  receivedAt: number;
  deliveryAttempt: number;
}

export interface SeenStore {
  markIfNew(key: string, ttlSeconds: number): Promise<boolean>;
  forget(key: string): Promise<void>;
}

export interface SpendLedger {
  addSpend(advertiserId: string, campaignId: string, costMicros: number, at: string): Promise<void>;
}
