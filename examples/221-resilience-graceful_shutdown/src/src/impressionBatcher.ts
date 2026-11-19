export interface Impression {
  campaignId: string;
  creativeId: string;
  placement: string;
  ts: number;
}

export interface WarehouseSink {
  insert(rows: Impression[]): Promise<void>;
}

export class ImpressionBatcher {
  private buffer: Impression[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> = Promise.resolve();

  constructor(private sink: WarehouseSink, private maxBatch = 500, private intervalMs = 5_000) {}

  start(): void {
    this.timer = setInterval(() => void this.flush(), this.intervalMs);
  }

  add(e: Impression): void {
    this.buffer.push(e);
    if (this.buffer.length >= this.maxBatch) void this.flush();
  }

  flush(): Promise<void> {
    this.flushing = this.flushing.then(async () => {
      if (this.buffer.length === 0) return;
      const rows = this.buffer;
      this.buffer = [];
      try {
        await this.sink.insert(rows);
      } catch (err) {
        console.error("impression flush failed, requeueing", rows.length, err);
        this.buffer = rows.concat(this.buffer);
      }
    });
    return this.flushing;
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }
}
