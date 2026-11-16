import { promises as fs } from "fs";

export interface ProviderSettings {
  host: string;
  port: number;
  timeoutMs: number;
  maxConnections: number;
}

export interface NotifierConfig {
  email: ProviderSettings & { fromAddress: string };
  sms: ProviderSettings & { senderId: string };
  quietHours: { startHour: number; endHour: number };
  batchSize: number;
}

const DEFAULTS: NotifierConfig = {
  email: { host: "smtp.internal", port: 587, timeoutMs: 10_000, maxConnections: 10, fromAddress: "no-reply@notify.local" },
  sms: { host: "sms-gw.internal", port: 443, timeoutMs: 5_000, maxConnections: 20, senderId: "NOTIFY" },
  quietHours: { startHour: 22, endHour: 7 },
  batchSize: 200,
};

export class ConfigLoadError extends Error {}

function applyEnv(cfg: NotifierConfig, env: NodeJS.ProcessEnv): NotifierConfig {
  const out = { ...cfg, email: { ...cfg.email }, sms: { ...cfg.sms } };
  if (env.SMTP_HOST) out.email.host = env.SMTP_HOST;
  if (env.SMTP_PORT) out.email.port = Number(env.SMTP_PORT);
  if (env.SMS_GATEWAY_HOST) out.sms.host = env.SMS_GATEWAY_HOST;
  if (env.NOTIFY_BATCH_SIZE) out.batchSize = Number(env.NOTIFY_BATCH_SIZE);
  return out;
}

function check(cfg: NotifierConfig): void {
  for (const [name, p] of [["email", cfg.email], ["sms", cfg.sms]] as const) {
    if (!p.host) throw new ConfigLoadError(`${name}.host missing`);
    if (!Number.isInteger(p.port)) throw new ConfigLoadError(`${name}.port invalid`);
  }
  if (!Number.isInteger(cfg.batchSize) || cfg.batchSize < 1) {
    throw new ConfigLoadError("batchSize invalid");
  }
}

export async function loadNotifierConfig(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<NotifierConfig> {
  let fromFile: Partial<NotifierConfig> = {};
  try {
    fromFile = JSON.parse(await fs.readFile(path, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ConfigLoadError(`failed to load ${path}: ${(err as Error).message}`);
    }
  }
  const merged: NotifierConfig = { ...DEFAULTS, ...fromFile };
  const cfg = applyEnv(merged, env);
  check(cfg);
  return cfg;
}
