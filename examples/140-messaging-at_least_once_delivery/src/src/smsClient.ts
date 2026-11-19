export interface SmsRequest {
  to: string;
  text: string;
  idempotencyKey: string;
}

export class SmsClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async send(req: SmsRequest): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        "idempotency-key": req.idempotencyKey,
      },
      body: JSON.stringify({ to: req.to, text: req.text }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 409) return;
    if (!res.ok) {
      throw new Error(`sms provider responded ${res.status}`);
    }
  }
}
