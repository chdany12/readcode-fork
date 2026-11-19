import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { Pool } from "pg";
import { SaveStore } from "./saveStore";
import { KeyRing } from "./saveCrypto";

function loadKeyRing(): KeyRing {
  const keys = new Map<number, Buffer>();
  for (const [name, value] of Object.entries(process.env)) {
    const match = /^SAVE_KEY_V(\d+)$/.exec(name);
    if (match && value) keys.set(Number(match[1]), Buffer.from(value, "base64"));
  }
  const activeVersion = Number(process.env.SAVE_KEY_ACTIVE);
  if (!keys.has(activeVersion)) throw new Error("SAVE_KEY_ACTIVE does not reference a loaded key");
  return { activeVersion, keys };
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: readFileSync(process.env.DB_CA_PATH ?? "/etc/ssl/rds-ca.pem"), rejectUnauthorized: true },
});
const store = new SaveStore(db, loadKeyRing());

createServer(
  {
    key: readFileSync(process.env.TLS_KEY_PATH!),
    cert: readFileSync(process.env.TLS_CERT_PATH!),
    minVersion: "TLSv1.2",
  },
  async (req, res) => {
    const match = /^\/saves\/(\d+)$/.exec(req.url ?? "");
    const playerId = req.headers["x-player-id"];
    if (!match || typeof playerId !== "string") {
      res.writeHead(404).end();
      return;
    }
    try {
      const save = await store.read(playerId, Number(match[1]));
      if (!save) return void res.writeHead(404).end();
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(save));
    } catch {
      res.writeHead(500).end();
    }
  },
).listen(8443);
