import { Channel, ConsumeMessage } from "amqplib";
import { parseReading, Reading, InvalidReadingError } from "./reading";

export interface ReadingSink {
  write(reading: Reading): Promise<void>;
}

export interface Logger {
  warn(msg: string, fields: object): void;
  error(msg: string, fields: object): void;
}

export const TELEMETRY_QUEUE = "telemetry.readings";
export const RETRY_EXCHANGE = "telemetry.retry";
export const DLQ = "telemetry.readings.dlq";
const MAX_ATTEMPTS = 5;

function attemptsOf(msg: ConsumeMessage): number {
  const raw = msg.properties.headers?.["x-attempts"];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export class TelemetryConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly sink: ReadingSink,
    private readonly log: Logger,
  ) {}

  async start(): Promise<void> {
    await this.channel.prefetch(50);
    await this.channel.consume(TELEMETRY_QUEUE, (msg) => {
      if (msg) void this.handle(msg);
    });
  }

  private async handle(msg: ConsumeMessage): Promise<void> {
    const attempts = attemptsOf(msg);
    try {
      const reading = parseReading(msg.content);
      await this.sink.write(reading);
      this.channel.ack(msg);
    } catch (err) {
      try {
        if (err instanceof InvalidReadingError || attempts >= MAX_ATTEMPTS) {
          await this.deadLetter(msg, attempts, err);
        } else {
          await this.scheduleRetry(msg, attempts);
        }
        this.channel.ack(msg);
      } catch (publishErr) {
        this.log.error("failed to reroute telemetry message; requeueing", {
          messageId: msg.properties.messageId,
          error: String(publishErr),
        });
        this.channel.nack(msg, false, true);
      }
    }
  }

  private async scheduleRetry(msg: ConsumeMessage, attempts: number): Promise<void> {
    const delayMs = Math.min(60_000, 1000 * 2 ** (attempts - 1));
    await this.publishConfirmed(RETRY_EXCHANGE, TELEMETRY_QUEUE, msg, {
      "x-attempts": attempts + 1,
      "x-delay": delayMs,
    });
  }

  private async deadLetter(msg: ConsumeMessage, attempts: number, err: unknown): Promise<void> {
    this.log.warn("dead-lettering telemetry message", {
      messageId: msg.properties.messageId,
      attempts,
      reason: err instanceof Error ? err.name : "unknown",
    });
    await this.publishConfirmed("", DLQ, msg, {
      "x-attempts": attempts,
      "x-dead-letter-reason": err instanceof Error ? err.message.slice(0, 500) : String(err),
      "x-original-queue": TELEMETRY_QUEUE,
      "x-dead-lettered-at": new Date().toISOString(),
    });
  }

  private publishConfirmed(exchange: string, routingKey: string, msg: ConsumeMessage, headers: object): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel.publish(
        exchange,
        routingKey,
        msg.content,
        {
          persistent: true,
          messageId: msg.properties.messageId,
          contentType: msg.properties.contentType,
          headers: { ...msg.properties.headers, ...headers },
        },
        (err: unknown) => (err ? reject(err) : resolve()),
      );
    });
  }
}
