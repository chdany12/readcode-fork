import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

export interface EncryptedField {
  keyId: string;
  iv: string;
  tag: string;
  data: string;
}

export interface KeyProvider {
  currentKeyId(): string;
  getKey(keyId: string): Promise<Buffer>;
}

export class FieldCipher {
  constructor(private readonly keys: KeyProvider) {}

  async encrypt(ticketId: string, plaintext: string): Promise<EncryptedField> {
    const keyId = this.keys.currentKeyId();
    const key = await this.keys.getKey(keyId);
    const iv = createHash("sha256").update(ticketId).digest().subarray(0, 12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(ticketId, "utf8"));
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      keyId,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64"),
    };
  }

  async decrypt(ticketId: string, field: EncryptedField): Promise<string> {
    const key = await this.keys.getKey(field.keyId);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(field.iv, "base64"));
    decipher.setAAD(Buffer.from(ticketId, "utf8"));
    decipher.setAuthTag(Buffer.from(field.tag, "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(field.data, "base64")), decipher.final()]);
    return out.toString("utf8");
  }
}
