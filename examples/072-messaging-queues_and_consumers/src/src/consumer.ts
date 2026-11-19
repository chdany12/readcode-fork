import { QueueClient, ReceivedMessage } from "./queueClient";
import { NotificationSender, PermanentDeliveryError } from "./sender";

export interface ConsumerOptions {
  queue: string;
  deadLetterQueue: string;
  maxInFlight: number;
  maxAttempts: number;
  baseRetryDelaySec: number;
  pollWaitSec: number;
}

export interface NotificationJob {
  notificationId: string;
  userId: string;
  channel: "email" | "sms" | "push";
  templateId: string;
  params: Record<string, string>;
}

export class NotificationConsumer {
  private running = false;
  private inFlight = new Set<Promise<void>>();
  private loopDone: Promise<void> | null = null;

  constructor(
    private readonly queue: QueueClient,
    private readonly sender: NotificationSender,
    private readonly opts: ConsumerOptions,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopDone = this.pollLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loopDone;
    await Promise.allSettled([...this.inFlight]);
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      const capacity = this.opts.maxInFlight - this.inFlight.size;
      if (capacity <= 0) {
        await Promise.race(this.inFlight);
        continue;
      }
      let messages: ReceivedMessage[];
      try {
        messages = await this.queue.receive(this.opts.queue, capacity, this.opts.pollWaitSec);
      } catch (err) {
        console.error("receive failed", { queue: this.opts.queue, err });
        await delay(1000);
        continue;
      }
      for (const msg of messages) {
        const task = this.handle(msg).finally(() => this.inFlight.delete(task));
        this.inFlight.add(task);
      }
    }
  }

  private async handle(msg: ReceivedMessage): Promise<void> {
    let job: NotificationJob;
    try {
      job = JSON.parse(msg.body) as NotificationJob;
    } catch {
      await this.deadLetter(msg, "unparseable body");
      return;
    }
    try {
      await this.sender.send(job, { idempotencyKey: job.notificationId });
      await this.queue.ack(this.opts.queue, msg.receiptHandle);
    } catch (err) {
      if (err instanceof PermanentDeliveryError || msg.receiveCount >= this.opts.maxAttempts) {
        await this.deadLetter(msg, String(err));
        return;
      }
      const backoff = this.opts.baseRetryDelaySec * 2 ** (msg.receiveCount - 1);
      await this.queue
        .changeVisibility(this.opts.queue, msg.receiptHandle, Math.min(backoff, 900))
        .catch((e) => console.error("visibility change failed", { id: msg.id, e }));
    }
  }

  private async deadLetter(msg: ReceivedMessage, reason: string): Promise<void> {
    try {
      await this.queue.send(this.opts.deadLetterQueue, msg.body, { reason, sourceId: msg.id });
      await this.queue.ack(this.opts.queue, msg.receiptHandle);
    } catch (err) {
      console.error("dead-letter failed; message will be redelivered", { id: msg.id, err });
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
