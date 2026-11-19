import { createHmac, timingSafeEqual } from "node:crypto";
import { SecretStore } from "./secretStore";
import { logger } from "./logger";

const API_KEY_ID = "prod/orders/payments-api-key";
const WEBHOOK_SECRET_ID = "prod/orders/payments-webhook-secret";

export class PaymentsClient {
  constructor(private readonly secrets: SecretStore, private readonly baseUrl: string) {}

  async capture(orderId: string, amountCents: number): Promise<{ captureId: string }> {
    let res = await this.post("/v1/captures", { orderId, amountCents });
    if (res.status === 401) {
      this.secrets.invalidate(API_KEY_ID);
      res = await this.post("/v1/captures", { orderId, amountCents });
    }
    if (!res.ok) {
      logger.warn({ orderId, status: res.status }, "payment capture failed");
      throw new Error(`capture failed for order ${orderId}: HTTP ${res.status}`);
    }
    return (await res.json()) as { captureId: string };
  }

  private async post(pathname: string, body: unknown): Promise<Response> {
    const apiKey = await this.secrets.get(API_KEY_ID);
    return fetch(new URL(pathname, this.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": (body as { orderId: string }).orderId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  }

  async verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<boolean> {
    if (!signatureHeader || !/^[a-f0-9]{64}$/.test(signatureHeader)) return false;
    const secret = await this.secrets.get(WEBHOOK_SECRET_ID);
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const provided = Buffer.from(signatureHeader, "hex");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
}
