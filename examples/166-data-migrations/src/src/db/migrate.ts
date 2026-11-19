import { Pool, PoolClient } from "pg";

export interface Migration {
  version: number;
  name: string;
  up(tx: PoolClient): Promise<void>;
}

export async function migrate(pool: Pool, all: Migration[]): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS iam_schema_version (
         version integer PRIMARY KEY,
         name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await client.query("SELECT pg_advisory_lock(hashtext('iam_schema_version'))");
    try {
      const { rows } = await client.query<{ max: number | null }>(
        "SELECT max(version) AS max FROM iam_schema_version",
      );
      const current = rows[0].max ?? 0;
      const pending = all.filter((m) => m.version > current).sort((a, b) => a.version - b.version);

      for (const m of pending) {
        await client.query("INSERT INTO iam_schema_version (version, name) VALUES ($1, $2)", [
          m.version,
          m.name,
        ]);
        await client.query("BEGIN");
        try {
          await m.up(client);
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`IAM migration ${m.version} (${m.name}) failed`, { cause: err });
        }
      }
      return pending.length;
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('iam_schema_version'))");
    }
  } finally {
    client.release();
  }
}
