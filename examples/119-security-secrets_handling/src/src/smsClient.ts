import type { SmsProviderConfig } from "./config";

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export interface OutboundSms {
  notificationId: string;
  to: string;
  body: string;
}

export class SmsSendError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "SmsSendError";
  }
}

function maskPhone(to: string): string {
  return to.length <= 4 ? "****" : `${"*".repeat(to.length - 4)}${to.slice(-4)}`;
}

export class SmsClient {
  private readonly authHeader: string;

  constructor(private readonly cfg: SmsProviderConfig, private readonly log: Logger) {
    const basic = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
    this.authHeader = `Basic ${basic}`;
  }

  async send(msg: OutboundSms): Promise<string> {
    const url = `${this.cfg.baseUrl}/v2/accounts/${this.cfg.accountSid}/messages`;
    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        "Idempotency-Key": msg.notificationId,
      },
      body: JSON.stringify({ from: this.cfg.senderId, to: msg.to, text: msg.body }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    };

    let res: Response;
    try {
      res = await fetch(url, requestInit);
    } catch (err) {
      this.log.error("sms transport failure", {
        notificationId: msg.notificationId,
        to: maskPhone(msg.to),
        cause: (err as Error).name,
      });
      throw new SmsSendError("transport failure", true);
    }

    if (!res.ok) {
      const providerBody = await res.text().catch(() => "");
      this.log.error("sms provider rejected message", {
        notificationId: msg.notificationId,
        status: res.status,
        providerBody: providerBody.slice(0, 500),
        request: { url, headers: requestInit.headers },
      });
      throw new SmsSendError(`provider status ${res.status}`, res.status >= 500 || res.status === 429);
    }

    const payload = (await res.json()) as { sid: string };
    this.log.info("sms accepted", { notificationId: msg.notificationId, providerSid: payload.sid, to: maskPhone(msg.to) });
    return payload.sid;
  }
}
