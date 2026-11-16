import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { MerchantKeyStore, MerchantKey } from "./merchantKeys";

const SIGNATURE_HEADER = "x-billing-signature";
const TIMESTAMP_HEADER = "x-billing-timestamp";
const KEY_ID_HEADER = "x-billing-key-id";
const TOLERANCE_SECONDS = 300;

export interface AuthenticatedRequest extends Request {
  merchantId?: string;
  rawBody?: Buffer;
}

export function computeSignature(secret: string, timestamp: string, body: Buffer): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function merchantSignatureAuth(keys: MerchantKeyStore) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const keyId = req.header(KEY_ID_HEADER);
    const timestamp = req.header(TIMESTAMP_HEADER);
    const signature = req.header(SIGNATURE_HEADER);

    if (!keyId || !timestamp || !signature) {
      return res.status(401).json({ error: "missing_credentials" });
    }

    const ts = Number(timestamp);
    if (!Number.isInteger(ts)) {
      return res.status(401).json({ error: "invalid_timestamp" });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - ts > TOLERANCE_SECONDS) {
      return res.status(401).json({ error: "stale_request" });
    }

    let key: MerchantKey | null;
    try {
      key = await keys.findActive(keyId);
    } catch (err) {
      req.log?.error({ err, keyId }, "merchant key lookup failed");
      return res.status(503).json({ error: "auth_unavailable" });
    }

    if (!key) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const body = req.rawBody ?? Buffer.alloc(0);
    const expected = computeSignature(key.secret, timestamp, body);
    if (!safeEqualHex(signature, expected)) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    req.merchantId = key.merchantId;
    next();
  };
}
