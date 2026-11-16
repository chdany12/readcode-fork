import { OutboundSms, SmsProvider } from "./smsProvider";

export interface SmsOutboxStore {
  markAccepted(messageId: string, providerMessageId: string, state: string): Promise<void>;
  reschedule(messageId: string, notBefore: Date, reason: string): Promise<void>;
  markFailed(messageId: string, reason: string): Promise<void>;
}

export class SmsSendWorker {
  constructor(private readonly provider: SmsProvider, private readonly outbox: SmsOutboxStore) {}

  async handle(sms: OutboundSms): Promise<void> {
    const outcome = await this.provider.send(sms);
    switch (outcome.kind) {
      case "accepted":
        await this.outbox.markAccepted(sms.messageId, outcome.result.providerMessageId, outcome.result.state);
        return;
      case "retry_later":
        await this.outbox.reschedule(sms.messageId, new Date(Date.now() + outcome.afterMs), outcome.reason);
        return;
      case "permanent_failure":
        await this.outbox.markFailed(sms.messageId, outcome.reason);
        return;
    }
  }
}
