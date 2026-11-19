export interface ImpressionEvent {
  campaignId: string;
  creativeId: string;
  ts: number;
  costMicros: number;
}

export interface WarehouseSink {
  insertRows(table: string, rows: Record<string, unknown>[]): Promise<void>;
}

export interface Metrics {
  increment(name: string, value?: number): void;
}
