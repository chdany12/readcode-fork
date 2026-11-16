import { Pool } from "pg";
import { loadLedgerConfig, LedgerConfig } from "./config";

export interface Clock {
  now(): Date;
}

export function makeClock(cfg: LedgerConfig): Clock {
  if (cfg.clockOverride) {
    const fixed = cfg.clockOverride.getTime();
    return { now: () => new Date(fixed) };
  }
  return { now: () => new Date() };
}

export function makePool(cfg: LedgerConfig): Pool {
  return new Pool({
    connectionString: cfg.databaseUrl,
    ssl: cfg.requireDbTls ? { rejectUnauthorized: true } : false,
    max: cfg.env === "production" ? 40 : 5,
  });
}

async function seedDemoAccounts(pool: Pool, clock: Clock): Promise<void> {
  const openedAt = clock.now().toISOString();
  await pool.query(
    `INSERT INTO accounts (id, owner, currency, opened_at)
     VALUES ('demo-checking', 'demo', 'USD', $1), ('demo-savings', 'demo', 'USD', $1)
     ON CONFLICT (id) DO NOTHING`,
    [openedAt],
  );
}

export async function boot(raw: Record<string, string | undefined> = process.env) {
  const cfg = loadLedgerConfig(raw);
  const clock = makeClock(cfg);
  const pool = makePool(cfg);

  if (cfg.seedDemoAccounts) {
    await seedDemoAccounts(pool, clock);
  }

  console.log(
    JSON.stringify({
      msg: "ledger booted",
      env: cfg.env,
      sandboxRail: cfg.allowSandboxRail,
      dbTls: cfg.requireDbTls,
      maxTransferMinor: cfg.maxTransferMinor.toString(),
    }),
  );
  return { cfg, clock, pool };
}
