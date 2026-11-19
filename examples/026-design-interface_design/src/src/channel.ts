export type Priority = "low" | "normal" | "urgent";

export interface OutboundMessage {
  userId: string;
  templateId: string;
  subject: string;
  body: string;
  priority: Priority;
}

export type SendOutcome =
  | { kind: "delivered"; providerMessageId: string }
  | { kind: "retryable"; reason: string }
  | { kind: "rejected"; reason: string };

export interface NotificationChannel {
  readonly id: "push" | "email" | "sms";
  supports(msg: OutboundMessage): boolean;
  send(msg: OutboundMessage, address: string): Promise<SendOutcome>;
}

export interface ContactBook {
  addressFor(userId: string, channel: NotificationChannel["id"]): Promise<string | null>;
}
