import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "pv1";

export class TravelerDocumentVault {
  constructor(private readonly keys: Record<string, Buffer>, private readonly currentKeyId: string) {
    const current = keys[currentKeyId];
    if (!current || current.length !== 32) {
      throw new Error("current document key must be 32 bytes");
    }
  }

  encrypt(bookingId: string, passportNumber: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.keys[this.currentKeyId], iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(`booking:${bookingId}`));
    const ct = Buffer.concat([cipher.update(passportNumber, "utf8"), cipher.final()]);
    const blob = Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
    return `${PREFIX}.${this.currentKeyId}.${blob}`;
  }

  decrypt(bookingId: string, stored: string): string {
    const [prefix, keyId, blob] = stored.split(".");
    if (prefix !== PREFIX || !keyId || !blob) throw new Error("malformed document ciphertext");
    const key = this.keys[keyId];
    if (!key) throw new Error(`document key ${keyId} not loaded`);
    const raw = Buffer.from(blob, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error("document ciphertext truncated");
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(`booking:${bookingId}`));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  }

  needsRotation(stored: string): boolean {
    const keyId = stored.split(".")[1] ?? "";
    const a = Buffer.from(keyId);
    const b = Buffer.from(this.currentKeyId);
    return a.length !== b.length || !timingSafeEqual(a, b);
  }
}
