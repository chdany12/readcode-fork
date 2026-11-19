import { Pool, PoolClient } from "pg";
import { createHash } from "crypto";

export interface Migration {
  id: string;
  up: (client: PoolClient) => Promise<void>;
  transactional?: boolean;
}

const LOCK_KEY = 72_410_993;

export class MigrationRunner {
  constructor(private readonly pool: Pool, private readonly log = console) {}

  async run(migrations: Migration[]): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
      try {
        await client.query(
          `CREATE TABLE IF NOT EXISTS schema_migrations (
             id text PRIMARY KEY,
             checksum text NOT NULL,
             applied_at timestamptz NOT NULL DEFAULT now()
           )`,
        );
        const { rows } = await client.query<{ id: string; checksum: string }>(
          "SELECT id, checksum FROM schema_migrations",
        );
        const applied = new Map(rows.map((r) => [r.id, r.checksum]));
        const ran: string[] = [];

        for (const m of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
          const checksum = createHash("sha256").update(m.up.toString()).digest("hex");
          const prior = applied.get(m.id);
          if (prior !== undefined) {
            if (prior !== checksum) {
              throw new Error(`migration ${m.id} was modified after being applied`);
            }
            continue;
          }
          await this.applyOne(client, m, checksum);
          ran.push(m.id);
        }
        return ran;
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }

  private async applyOne(client: PoolClient, m: Migration, checksum: string) {
    const record = () =>
      client.query("INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)", [m.id, checksum]);

    if (m.transactional === false) {
      this.log.info(`applying ${m.id} (non-transactional)`);
      await m.up(client);
      await record();
      return;
    }

    this.log.info(`applying ${m.id}`);
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await m.up(client);
      await record();
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${m.id} failed: ${(err as Error).message}`);
    }
  }
}
