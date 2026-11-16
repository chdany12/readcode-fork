import { Pool } from "pg";
import { randomUUID } from "crypto";

export interface PlaybackSession {
  sessionId: string;
  accountId: string;
  deviceId: string;
  titleId: string;
  startedAt: Date;
}

export class ConcurrentStreamLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`account already has ${limit} active streams`);
  }
}

const HEARTBEAT_STALE_SECONDS = 90;

export class PlaybackSessionService {
  constructor(private readonly pool: Pool) {}

  async start(accountId: string, deviceId: string, titleId: string): Promise<PlaybackSession> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");

      const plan = await client.query(
        `SELECT p.max_streams FROM accounts a JOIN plans p ON p.id = a.plan_id
          WHERE a.id = $1`,
        [accountId]
      );
      const limit: number = plan.rows[0]?.max_streams ?? 1;

      await client.query(
        `DELETE FROM playback_sessions
          WHERE account_id = $1 AND device_id = $2`,
        [accountId, deviceId]
      );

      const active = await client.query(
        `SELECT count(*)::int AS n FROM playback_sessions
          WHERE account_id = $1
            AND last_heartbeat > now() - make_interval(secs => $2)`,
        [accountId, HEARTBEAT_STALE_SECONDS]
      );
      if (active.rows[0].n >= limit) {
        throw new ConcurrentStreamLimitError(limit);
      }

      const session: PlaybackSession = {
        sessionId: randomUUID(),
        accountId,
        deviceId,
        titleId,
        startedAt: new Date(),
      };
      await client.query(
        `INSERT INTO playback_sessions
           (session_id, account_id, device_id, title_id, started_at, last_heartbeat)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [session.sessionId, accountId, deviceId, titleId, session.startedAt]
      );
      await client.query("COMMIT");
      return session;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async heartbeat(sessionId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE playback_sessions SET last_heartbeat = now() WHERE session_id = $1`,
      [sessionId]
    );
    return (rowCount ?? 0) > 0;
  }

  async stop(sessionId: string): Promise<void> {
    await this.pool.query(`DELETE FROM playback_sessions WHERE session_id = $1`, [sessionId]);
  }
}
