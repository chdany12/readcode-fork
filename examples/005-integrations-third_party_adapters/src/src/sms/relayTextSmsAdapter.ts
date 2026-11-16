import { DeliveryState, OutboundSms, SendOutcome, SmsProvider } from "./smsProvider";

interface RelayTextConfig {
  baseUrl: string;
  accountSid: string;
  authToken: string;
  senderId: string;
  timeoutMs: number;
}

interface RelayTextMessage {
  sid: string;
  status: string;
}

interface RelayTextError {
  code: number;
  message: string;
}

const PERMANENT_ERROR_CODES = new Set([21211, 21610, 21614]);
const DEFAULT_RETRY_MS = 30_000;
const MAX_RETRY_MS = 15 * 60_000;

export class RelayTextSmsAdapter implements SmsProvider {
  constructor(private readonly cfg: RelayTextConfig) {}

  async send(sms: OutboundSms): Promise<SendOutcome> {
    const form = new URLSearchParams({
      To: sms.to,
      From: this.cfg.senderId,
      Body: sms.body,
    });
    const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString("base64");

    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl}/Accounts/${this.cfg.accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `sms-${sms.messageId}`,
        },
        body: form,
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
    } catch (err) {
      return { kind: "retry_later", afterMs: DEFAULT_RETRY_MS, reason: `transport: ${(err as Error).name}` };
    }

    if (res.status === 429 || res.status >= 500) {
      return {
        kind: "retry_later",
        afterMs: parseRetryAfter(res.headers.get("Retry-After")),
        reason: `http ${res.status}`,
      };
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as RelayTextError | null;
      if (err && PERMANENT_ERROR_CODES.has(err.code)) {
        return { kind: "permanent_failure", reason: `relaytext ${err.code}: ${err.message}` };
      }
      if (res.status === 401 || res.status === 403) {
        return { kind: "retry_later", afterMs: MAX_RETRY_MS, reason: "provider auth rejected" };
      }
      return { kind: "permanent_failure", reason: `http ${res.status}` };
    }

    const msg = (await res.json()) as RelayTextMessage;
    return { kind: "accepted", result: { providerMessageId: msg.sid, state: this.mapStatus(msg.status) } };
  }

  mapStatus(raw: string): DeliveryState {
    switch (raw) {
      case "accepted":
      case "queued":
      case "sending":
        return "queued";
      case "sent":
        return "sent";
      case "delivered":
        return "delivered";
      case "undelivered":
      case "failed":
        return "failed";
      default:
        return "queued";
    }
  }
}

function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_RETRY_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_MS);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_MS);
  }
  return DEFAULT_RETRY_MS;
}
