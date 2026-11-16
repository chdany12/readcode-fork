export type DeliveryState = "queued" | "sent" | "delivered" | "failed";

export interface OutboundSms {
  messageId: string;
  to: string;
  body: string;
}

export interface SendResult {
  providerMessageId: string;
  state: DeliveryState;
}

export type SendOutcome =
  | { kind: "accepted"; result: SendResult }
  | { kind: "retry_later"; afterMs: number; reason: string }
  | { kind: "permanent_failure"; reason: string };

export interface SmsProvider {
  send(sms: OutboundSms): Promise<SendOutcome>;
  mapStatus(raw: string): DeliveryState;
}
