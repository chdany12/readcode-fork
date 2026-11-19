export type DeployEnv = "development" | "test" | "staging" | "production";

export interface LedgerConfig {
  env: DeployEnv;
  databaseUrl: string;
  paymentRailUrl: string;
  allowSandboxRail: boolean;
  seedDemoAccounts: boolean;
  requireDbTls: boolean;
  maxTransferMinor: bigint;
  clockOverride: Date | null;
}

const KNOWN_ENVS: DeployEnv[] = ["development", "test", "staging", "production"];
const SANDBOX_HOST_SUFFIX = ".sandbox.rails.internal";

function readEnv(raw: Record<string, string | undefined>): DeployEnv {
  const value = (raw.LEDGER_ENV ?? "").trim().toLowerCase();
  if (!KNOWN_ENVS.includes(value as DeployEnv)) {
    throw new Error(`LEDGER_ENV must be one of ${KNOWN_ENVS.join(", ")}, got "${value}"`);
  }
  return value as DeployEnv;
}

function required(raw: Record<string, string | undefined>, key: string): string {
  const value = raw[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function loadLedgerConfig(raw: Record<string, string | undefined>): LedgerConfig {
  const env = readEnv(raw);
  const isLive = env === "production";
  const isLocal = env === "development" || env === "test";

  const databaseUrl = required(raw, "DATABASE_URL");
  const paymentRailUrl = required(raw, "PAYMENT_RAIL_URL");
  const railHost = new URL(paymentRailUrl).hostname;
  const railIsSandbox = railHost.endsWith(SANDBOX_HOST_SUFFIX);

  if (isLive && railIsSandbox) {
    throw new Error("production cannot point at a sandbox payment rail");
  }
  if (!isLive && !railIsSandbox) {
    throw new Error(`${env} must use a sandbox payment rail, got ${railHost}`);
  }

  const clockRaw = raw.LEDGER_CLOCK_OVERRIDE;
  let clockOverride: Date | null = null;
  if (clockRaw !== undefined && clockRaw !== "") {
    if (!isLocal) {
      throw new Error("LEDGER_CLOCK_OVERRIDE is only allowed in development and test");
    }
    const parsed = new Date(clockRaw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`LEDGER_CLOCK_OVERRIDE is not a valid date: ${clockRaw}`);
    }
    clockOverride = parsed;
  }

  const limitRaw = raw.MAX_TRANSFER_MINOR ?? (isLive ? "" : "100000");
  if (!/^[0-9]+$/.test(limitRaw)) {
    throw new Error("MAX_TRANSFER_MINOR must be set to a non-negative integer");
  }

  return {
    env,
    databaseUrl,
    paymentRailUrl,
    allowSandboxRail: railIsSandbox,
    seedDemoAccounts: isLocal && raw.SEED_DEMO_ACCOUNTS === "true",
    requireDbTls: !isLocal,
    maxTransferMinor: BigInt(limitRaw),
    clockOverride,
  };
}
