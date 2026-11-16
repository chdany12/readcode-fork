import { ImpressionEvent, Metrics, WarehouseSink } from "./types";

export class ImpressionBuffer {
  private pending: ImpressionEvent[] = [];
  private flushing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sink: WarehouseSink,
    private readonly metrics: Metrics,
    private readonly maxBatch = 1000,
    private readonly flushIntervalMs = 2000,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  record(evt: ImpressionEvent): void {
    this.pending.push(evt);
    if (this.pending.length >= this.maxBatch) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    const batch = this.pending.splice(0, this.maxBatch);
    try {
      return this.sink.insertRows("impressions", batch.map(toRow));
    } catch (err) {
      this.pending.unshift(...batch);
      this.metrics.increment("impressions.flush_failed");
    } finally {
      this.flushing = false;
      this.metrics.increment("impressions.flushed", batch.length);
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    while (this.pending.length > 0 && !this.flushing) {
      await this.flush();
    }
  }
}

function toRow(evt: ImpressionEvent): Record<string, unknown> {
  return {
    campaign_id: evt.campaignId,
    creative_id: evt.creativeId,
    event_time: new Date(evt.ts).toISOString(),
    cost_micros: evt.costMicros,
  };
}
