import { OrderStatusEvent } from "./model";
import { OrderStatusProjector } from "./orderStatusProjector";

export interface PartitionBatch {
  topic: string;
  partition: number;
  messages: { offset: string; key: string; value: Buffer }[];
}

export interface OffsetCommitter {
  commit(topic: string, partition: number, offset: string): Promise<void>;
}

export interface Metrics {
  increment(name: string, tags?: Record<string, string>): void;
}

export class OrderEventsConsumer {
  constructor(
    private readonly projector: OrderStatusProjector,
    private readonly offsets: OffsetCommitter,
    private readonly metrics: Metrics,
  ) {}

  async handleBatch(batch: PartitionBatch): Promise<void> {
    if (batch.messages.length === 0) {
      return;
    }

    const events = batch.messages
      .map((m) => this.decode(m.key, m.value))
      .filter((e): e is OrderStatusEvent => e !== null);

    const results = await Promise.all(events.map((e) => this.projector.apply(e)));

    for (const applied of results) {
      this.metrics.increment(applied ? "order_status.applied" : "order_status.skipped", {
        partition: String(batch.partition),
      });
    }

    const last = batch.messages[batch.messages.length - 1];
    await this.offsets.commit(batch.topic, batch.partition, last.offset);
  }

  private decode(key: string, value: Buffer): OrderStatusEvent | null {
    try {
      const parsed = JSON.parse(value.toString("utf8")) as OrderStatusEvent;
      if (parsed.orderId !== key || typeof parsed.version !== "number") {
        this.metrics.increment("order_status.malformed");
        return null;
      }
      return parsed;
    } catch {
      this.metrics.increment("order_status.unparseable");
      return null;
    }
  }
}
