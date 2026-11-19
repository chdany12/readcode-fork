import { QueueClient, QueueMessage, PostPublished } from "./queue";
import { FollowerStore, TimelineStore } from "./stores";

export interface FanoutOptions {
  batchSize: number;
  maxDeliveries: number;
  pageSize: number;
}

export class TimelineFanoutConsumer {
  private running = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly queue: QueueClient<PostPublished>,
    private readonly followers: FollowerStore,
    private readonly timelines: TimelineStore,
    private readonly opts: FanoutOptions,
    private readonly log: (msg: string, fields: Record<string, unknown>) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.run();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async run(): Promise<void> {
    while (this.running) {
      const batch = await this.queue.receive(this.opts.batchSize, 20_000);
      await Promise.all(batch.map((m) => this.handle(m)));
    }
  }

  private async handle(msg: QueueMessage<PostPublished>): Promise<void> {
    const { postId, authorId, publishedAt } = msg.body;
    try {
      let cursor: string | undefined;
      do {
        const page = await this.followers.page(authorId, this.opts.pageSize, cursor);
        await this.timelines.insertMany(
          page.userIds.map((userId) => ({ userId, postId, authorId, publishedAt })),
        );
        cursor = page.nextCursor;
      } while (cursor);
      await this.queue.ack(msg.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (msg.deliveryCount >= this.opts.maxDeliveries) {
        this.log("fanout dead-lettered", { postId, deliveryCount: msg.deliveryCount, reason });
        await this.queue.deadLetter(msg.id, reason);
        return;
      }
      const delayMs = Math.min(60_000, 1_000 * 2 ** msg.deliveryCount);
      this.log("fanout retry scheduled", { postId, deliveryCount: msg.deliveryCount, delayMs, reason });
      await this.queue.nack(msg.id, delayMs);
    }
  }
}
