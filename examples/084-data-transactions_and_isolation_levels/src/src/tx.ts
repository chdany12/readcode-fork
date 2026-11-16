import { Pool, PoolClient } from "pg";

const SERIALIZATION_FAILURE = "40001";
const DEADLOCK_DETECTED = "40P01";

export type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

export async function withTransaction<T>(
  pool: Pool,
  isolation: IsolationLevel,
  work: (client: PoolClient) => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let attempt = 0;
  for (;;) {
    attempt++;
    const client = await pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      const retryable = err?.code === SERIALIZATION_FAILURE || err?.code === DEADLOCK_DETECTED;
      if (!retryable || attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 10 * 2 ** attempt + Math.random() * 10));
    } finally {
      client.release();
    }
  }
}
