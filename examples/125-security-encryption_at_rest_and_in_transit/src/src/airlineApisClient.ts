import https from "node:https";
import { readFileSync } from "node:fs";
import { TravelerDocumentVault } from "./documentVault";

export interface SupplierConfig {
  host: string;
  caBundlePath: string;
  clientCertPath: string;
  clientKeyPath: string;
  timeoutMs: number;
}

export class AirlineApisClient {
  private readonly agent: https.Agent;

  constructor(private readonly cfg: SupplierConfig, private readonly vault: TravelerDocumentVault) {
    this.agent = new https.Agent({
      ca: readFileSync(cfg.caBundlePath),
      cert: readFileSync(cfg.clientCertPath),
      key: readFileSync(cfg.clientKeyPath),
      minVersion: "TLSv1.2",
      keepAlive: true,
      maxSockets: 20,
    });
  }

  async submitPassengerData(bookingId: string, surname: string, storedPassport: string): Promise<string> {
    const body = JSON.stringify({
      bookingRef: bookingId,
      surname,
      passportNumber: this.vault.decrypt(bookingId, storedPassport),
    });
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: this.cfg.host,
          path: "/v2/apis/passengers",
          method: "POST",
          agent: this.agent,
          headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
          timeout: this.cfg.timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(text).submissionId);
            } else {
              reject(new Error(`APIS submission for ${bookingId} failed with ${res.statusCode}`));
            }
          });
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error(`APIS submission timed out after ${this.cfg.timeoutMs}ms`)));
      req.on("error", reject);
      req.end(body);
    });
  }
}
