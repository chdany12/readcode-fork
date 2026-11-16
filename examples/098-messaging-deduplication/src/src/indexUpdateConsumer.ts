import { DedupLedger } from "./dedupLedger";

export interface IndexMessage {
  messageId: string;
  documentId: string;
  op: "upsert" | "delete";
  body?: Record<string, unknown>;
}

export interface Delivery {
  message: IndexMessage;
  ack(): Promise<void>;
  nack(opts: { requeue: boolean; delayMs?: number }): Promise<void>;
}

export interface SearchIndex {
  upsert(id: string, body: Record<string, unknown>): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export class IndexUpdateConsumer {
  constructor(
    private readonly ledger: DedupLedger,
    private readonly index: SearchIndex,
    private readonly log: Logger,
    private readonly inProgressRetryMs = 5_000,
  ) {}

  async handle(delivery: Delivery): Promise<void> {
    const { message } = delivery;
    const claim = await this.ledger.claim(message.messageId);

    if (claim === "done") {
      this.log.info("duplicate index message skipped", { messageId: message.messageId });
      await delivery.ack();
      return;
    }

    if (claim === "in_progress") {
      this.log.warn("index message already being processed", { messageId: message.messageId });
      await delivery.nack({ requeue: true, delayMs: this.inProgressRetryMs });
      return;
    }

    try {
      await this.apply(message);
    } catch (err) {
      await this.ledger.release(message.messageId);
      this.log.error("index update failed", {
        messageId: message.messageId,
        documentId: message.documentId,
        error: err instanceof Error ? err.message : String(err),
      });
      await delivery.nack({ requeue: true });
      return;
    }

    await this.ledger.complete(message.messageId);
    await delivery.ack();
  }

  private async apply(message: IndexMessage): Promise<void> {
    if (message.op === "delete") {
      await this.index.remove(message.documentId);
      return;
    }
    if (!message.body) {
      throw new Error(`upsert for ${message.documentId} has no body`);
    }
    await this.index.upsert(message.documentId, message.body);
  }
}
