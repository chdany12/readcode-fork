import { EventEmitter } from "node:events";

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
}

export interface PushGateway {
  sendBatch(messages: PushMessage[]): Promise<void>;
}

export interface BatcherOptions {
  flushIntervalMs: number;
  maxBatchSize: number;
}

export class PushBatcher extends EventEmitter {
  private pending: PushMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> = Promise.resolve();

  constructor(
    private readonly gateway: PushGateway,
    private readonly opts: BatcherOptions,
  ) {
    super();
  }

  enqueue(message: PushMessage): void {
    this.pending.push(message);
    if (this.pending.length >= this.opts.maxBatchSize) {
      this.flushNow();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flushNow(), this.opts.flushIntervalMs);
    }
  }

  private flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending.length === 0) return;
    const batch = this.pending.splice(0, this.pending.length);
    this.inFlight = this.inFlight
      .then(() => this.gateway.sendBatch(batch))
      .then(
        () => { this.emit("flushed", batch.length); },
        (err) => { this.emit("flushError", err, batch.length); },
      );
  }

  async drain(): Promise<void> {
    this.flushNow();
    await this.inFlight;
  }
}
