import { EventEmitter } from "events";

export interface OrderPlacedEvent {
  orderId: string;
  lines: { sku: string; quantity: number }[];
  offset: number;
}

export interface PartitionSource extends EventEmitter {
  pause(): void;
  resume(): void;
  commit(offset: number): Promise<void>;
}

export interface InventoryClient {
  reserve(orderId: string, sku: string, quantity: number): Promise<void>;
}

export interface ConsumerOptions {
  maxInFlight: number;
  resumeBelow: number;
}

export class ReservationConsumer {
  private inFlight = 0;
  private paused = false;
  private readonly pendingOffsets = new Set<number>();
  private committedThrough = -1;

  constructor(
    private readonly source: PartitionSource,
    private readonly inventory: InventoryClient,
    private readonly opts: ConsumerOptions,
    private readonly onFailure: (evt: OrderPlacedEvent, err: unknown) => Promise<void>,
  ) {
    if (opts.resumeBelow >= opts.maxInFlight) {
      throw new Error("resumeBelow must be lower than maxInFlight");
    }
  }

  start(): void {
    this.source.on("message", (evt: OrderPlacedEvent) => this.accept(evt));
  }

  private accept(evt: OrderPlacedEvent): void {
    this.inFlight++;
    this.pendingOffsets.add(evt.offset);
    if (!this.paused && this.inFlight >= this.opts.maxInFlight) {
      this.paused = true;
      this.source.pause();
    }
    this.process(evt).finally(() => this.release(evt.offset));
  }

  private async process(evt: OrderPlacedEvent): Promise<void> {
    try {
      for (const line of evt.lines) {
        await this.inventory.reserve(evt.orderId, line.sku, line.quantity);
      }
    } catch (err) {
      await this.onFailure(evt, err).catch(() => undefined);
    }
  }

  private release(offset: number): void {
    this.inFlight--;
    this.pendingOffsets.delete(offset);
    void this.advanceCommit(offset);
    if (this.paused && this.inFlight <= this.opts.resumeBelow) {
      this.paused = false;
      this.source.resume();
    }
  }

  private async advanceCommit(offset: number): Promise<void> {
    let lowestPending = Infinity;
    for (const o of this.pendingOffsets) {
      if (o < lowestPending) lowestPending = o;
    }
    const safe = lowestPending === Infinity ? offset : lowestPending - 1;
    if (safe > this.committedThrough) {
      this.committedThrough = safe;
      await this.source.commit(safe).catch(() => undefined);
    }
  }

  get stats(): { inFlight: number; paused: boolean } {
    return { inFlight: this.inFlight, paused: this.paused };
  }
}
