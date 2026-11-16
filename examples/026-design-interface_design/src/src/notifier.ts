import { ContactBook, NotificationChannel, OutboundMessage, SendOutcome } from "./channel";

export interface DeliveryReport {
  channel: NotificationChannel["id"] | null;
  attempts: Array<{ channel: NotificationChannel["id"]; outcome: SendOutcome["kind"] }>;
}

export class Notifier {
  constructor(
    private readonly channels: readonly NotificationChannel[],
    private readonly contacts: ContactBook,
  ) {}

  async notify(msg: OutboundMessage): Promise<DeliveryReport> {
    const report: DeliveryReport = { channel: null, attempts: [] };
    for (const channel of this.channels) {
      if (!channel.supports(msg)) continue;
      const address = await this.contacts.addressFor(msg.userId, channel.id);
      if (address === null) continue;

      let outcome: SendOutcome;
      try {
        outcome = await channel.send(msg, address);
      } catch (err) {
        outcome = { kind: "retryable", reason: String(err) };
      }
      report.attempts.push({ channel: channel.id, outcome: outcome.kind });
      if (outcome.kind === "delivered") {
        report.channel = channel.id;
        return report;
      }
    }
    return report;
  }
}
