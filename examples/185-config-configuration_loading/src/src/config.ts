import { readFileSync } from "fs";

export interface DispatchConfig {
  port: number;
  databaseUrl: string;
  courierSearchRadiusKm: number;
  maxOffersPerOrder: number;
  offerTimeoutMs: number;
  surge: { enabled: boolean; maxMultiplier: number };
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

const DEFAULTS: DispatchConfig = {
  port: 8080,
  databaseUrl: "",
  courierSearchRadiusKm: 5,
  maxOffersPerOrder: 3,
  offerTimeoutMs: 30_000,
  surge: { enabled: false, maxMultiplier: 2 },
};

function readFile(path: string | undefined): Partial<DispatchConfig> {
  if (!path) return {};
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new ConfigError(`cannot read config file ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text) as Partial<DispatchConfig>;
  } catch (err) {
    throw new ConfigError(`invalid JSON in ${path}: ${(err as Error).message}`);
  }
}

function num(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new ConfigError(`${name} must be a number, got "${raw}"`);
  }
  return value;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  throw new ConfigError(`${name} must be true/false, got "${raw}"`);
}

export function loadConfig(env: Env = process.env): Readonly<DispatchConfig> {
  const file = readFile(env.DISPATCH_CONFIG_FILE);
  const base: DispatchConfig = {
    ...DEFAULTS,
    ...file,
    surge: { ...DEFAULTS.surge, ...(file.surge ?? {}) },
  };

  const cfg: DispatchConfig = {
    port: num(env, "PORT", base.port),
    databaseUrl: env.DATABASE_URL ?? base.databaseUrl,
    courierSearchRadiusKm: num(env, "COURIER_RADIUS_KM", base.courierSearchRadiusKm),
    maxOffersPerOrder: num(env, "MAX_OFFERS_PER_ORDER", base.maxOffersPerOrder),
    offerTimeoutMs: num(env, "OFFER_TIMEOUT_MS", base.offerTimeoutMs),
    surge: {
      enabled: bool(env, "SURGE_ENABLED", base.surge.enabled),
      maxMultiplier: num(env, "SURGE_MAX_MULTIPLIER", base.surge.maxMultiplier),
    },
  };

  validate(cfg);
  return Object.freeze({ ...cfg, surge: Object.freeze({ ...cfg.surge }) });
}

function validate(cfg: DispatchConfig): void {
  const problems: string[] = [];
  if (!cfg.databaseUrl) problems.push("DATABASE_URL is required");
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) problems.push("port out of range");
  if (cfg.courierSearchRadiusKm <= 0 || cfg.courierSearchRadiusKm > 50) problems.push("courierSearchRadiusKm must be in (0, 50]");
  if (!Number.isInteger(cfg.maxOffersPerOrder) || cfg.maxOffersPerOrder < 1) problems.push("maxOffersPerOrder must be a positive integer");
  if (cfg.offerTimeoutMs < 1000) problems.push("offerTimeoutMs must be at least 1000");
  if (cfg.surge.maxMultiplier < 1) problems.push("surge.maxMultiplier must be >= 1");
  if (problems.length > 0) {
    throw new ConfigError(`invalid dispatch config:\n  - ${problems.join("\n  - ")}`);
  }
}
