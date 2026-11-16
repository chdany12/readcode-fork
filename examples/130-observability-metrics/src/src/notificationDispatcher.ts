import { Counter, Gauge, Histogram } from "./metrics";

export type Channel = "sms" | "email" | "push";

export interface Notification {
  id: string;
  userId: string;
  channel: Channel;
  body: string;
}

export interface ChannelProvider {
  send(n: Notification): Promise<{ providerMessageId: string }>;
}

export class ProviderRejectedError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const inFlight = new Gauge("notifications_in_flight");
const sendLatency = new Histogram("notification_send_seconds", [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]);
const sendResults = new Counter("notification_send_total");

export class NotificationDispatcher {
  constructor(private readonly providers: Record<Channel, ChannelProvider>) {}

  async deliver(n: Notification): Promise<string> {
    const provider = this.providers[n.channel];
    const labels = { channel: n.channel };
    const started = performance.now();

    inFlight.inc(labels);
    try {
      const { providerMessageId } = await provider.send(n);
      inFlight.dec(labels);
      sendResults.inc({ channel: n.channel, result: "sent" });
      return providerMessageId;
    } catch (err) {
      const result = err instanceof ProviderRejectedError ? "rejected" : "failed";
      sendResults.inc({ channel: n.channel, result });
      throw err;
    } finally {
      sendLatency.observe(labels, (performance.now() - started) / 1000);
    }
  }

  async deliverAll(batch: Notification[], concurrency = 8): Promise<PromiseSettledResult<string>[]> {
    const results: PromiseSettledResult<string>[] = new Array(batch.length);
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await this.deliver(batch[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
    return results;
  }
}
