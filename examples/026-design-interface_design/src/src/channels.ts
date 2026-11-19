import { NotificationChannel, OutboundMessage, SendOutcome } from "./channel";

export interface MailTransport {
  sendMail(to: string, subject: string, html: string): Promise<{ messageId: string }>;
}

export class EmailChannel implements NotificationChannel {
  readonly id = "email" as const;

  constructor(private readonly transport: MailTransport, private readonly unsubscribeBase: string) {}

  supports(_msg: OutboundMessage): boolean {
    return true;
  }

  async send(msg: OutboundMessage, address: string): Promise<SendOutcome> {
    if (msg.priority !== "urgent") {
      msg.body = `${msg.body}\n\nUnsubscribe: ${this.unsubscribeBase}?u=${encodeURIComponent(msg.userId)}`;
    }
    try {
      const { messageId } = await this.transport.sendMail(address, msg.subject, msg.body);
      return { kind: "delivered", providerMessageId: messageId };
    } catch (err) {
      const code = (err as { responseCode?: number }).responseCode ?? 0;
      return code >= 500 && code < 600
        ? { kind: "retryable", reason: `smtp ${code}` }
        : { kind: "rejected", reason: String(err) };
    }
  }
}

export interface SmsGateway {
  submit(to: string, text: string): Promise<{ sid: string; status: "queued" | "failed" }>;
}

export class SmsChannel implements NotificationChannel {
  readonly id = "sms" as const;

  constructor(private readonly gateway: SmsGateway, private readonly maxLength: number) {}

  supports(msg: OutboundMessage): boolean {
    return msg.priority !== "low";
  }

  async send(msg: OutboundMessage, address: string): Promise<SendOutcome> {
    const text = msg.body.length > this.maxLength ? msg.body.slice(0, this.maxLength - 1) + "…" : msg.body;
    const res = await this.gateway.submit(address, text);
    return res.status === "queued"
      ? { kind: "delivered", providerMessageId: res.sid }
      : { kind: "retryable", reason: "gateway reported failed" };
  }
}
