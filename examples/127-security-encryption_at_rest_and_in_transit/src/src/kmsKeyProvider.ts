import { readFileSync } from "node:fs";
import { request } from "node:https";
import { KeyProvider } from "./fieldCipher";

export class KmsKeyProvider implements KeyProvider {
  private readonly cache = new Map<string, Buffer>();
  private readonly ca = readFileSync(process.env.KMS_CA_PATH ?? "/etc/ssl/kms-ca.pem");

  constructor(private readonly baseUrl: string, private readonly activeKeyId: string) {}

  currentKeyId(): string {
    return this.activeKeyId;
  }

  async getKey(keyId: string): Promise<Buffer> {
    const cached = this.cache.get(keyId);
    if (cached) return cached;
    const key = await this.fetchKey(keyId);
    if (key.length !== 32) throw new Error(`key ${keyId} has unexpected length ${key.length}`);
    this.cache.set(keyId, key);
    return key;
  }

  private fetchKey(keyId: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = request(
        `${this.baseUrl}/v1/keys/${encodeURIComponent(keyId)}`,
        { method: "GET", ca: this.ca, timeout: 3000 },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            if (res.statusCode !== 200) return reject(new Error(`kms returned ${res.statusCode}`));
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { material: string };
            resolve(Buffer.from(parsed.material, "base64"));
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("kms request timed out")));
      req.on("error", reject);
      req.end();
    });
  }
}
