import { Logger } from "./logger";

export interface BrokerMessage {
  id: string;
  body: string;
  attributes: Record<string, string>;
  ack(): Promise<void>;
  nack(delayMs: number): Promise<void>;
}

export interface Publisher {
  publish(topic: string, body: string, attributes: Record<string, string>): Promise<void>;
}

export class NonRetryableError extends Error {}

export interface ConfirmationHandler {
  handle(payload: BookingConfirmation): Promise<void>;
}

export interface BookingConfirmation {
  bookingId: string;
  supplierRef: string;
  travellerEmail: string;
  totalCents: number;
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2_000;

export class ConfirmationConsumer {
  constructor(
    private readonly handler: ConfirmationHandler,
    private readonly publisher: Publisher,
    private readonly dlqTopic: string,
    private readonly log: Logger,
  ) {}

  async onMessage(msg: BrokerMessage): Promise<void> {
    const attempt = Number(msg.attributes["x-attempt"] ?? "1");
    let payload: BookingConfirmation;
    try {
      payload = JSON.parse(msg.body) as BookingConfirmation;
      if (!payload.bookingId || !payload.supplierRef) {
        throw new NonRetryableError("missing bookingId or supplierRef");
      }
    } catch (err) {
      await this.deadLetter(msg, attempt, err as Error, "malformed");
      return;
    }

    try {
      await this.handler.handle(payload);
      await msg.ack();
    } catch (err) {
      if (err instanceof NonRetryableError) {
        await this.deadLetter(msg, attempt, err, "non_retryable");
        return;
      }
      if (attempt >= MAX_ATTEMPTS) {
        await this.deadLetter(msg, attempt, err as Error, "exhausted");
        return;
      }
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      this.log.warn("confirmation.retry", { bookingId: payload.bookingId, attempt, delay });
      await this.publisher.publish("booking.confirmations", msg.body, {
        ...msg.attributes,
        "x-attempt": String(attempt + 1),
      });
      await msg.ack();
    }
  }

  private async deadLetter(
    msg: BrokerMessage,
    attempt: number,
    err: Error,
    reason: string,
  ): Promise<void> {
    const attributes = {
      ...msg.attributes,
      "x-dlq-reason": reason,
      "x-dlq-error": err.message.slice(0, 500),
      "x-dlq-attempts": String(attempt),
      "x-original-id": msg.id,
      "x-dead-lettered-at": new Date().toISOString(),
    };
    this.publisher
      .publish(this.dlqTopic, msg.body, attributes)
      .catch((e) => this.log.error("dlq.publish_failed", { id: msg.id, error: String(e) }));
    await msg.ack();
    this.log.error("confirmation.dead_lettered", { id: msg.id, reason, attempt });
  }
}
