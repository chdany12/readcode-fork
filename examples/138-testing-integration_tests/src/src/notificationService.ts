import { Pool, PoolClient } from "pg";

export interface NotificationRequest {
  userId: string;
  channel: "email" | "sms" | "push";
  templateId: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
}

export class NotificationPreferenceError extends Error {}

export class NotificationService {
  constructor(private readonly pool: Pool) {}

  async enqueue(req: NotificationRequest): Promise<{ id: string; created: boolean }> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const pref = await client.query(
        "SELECT opted_out FROM notification_preferences WHERE user_id = $1 AND channel = $2",
        [req.userId, req.channel],
      );
      if (pref.rows[0]?.opted_out) {
        throw new NotificationPreferenceError(`user ${req.userId} opted out of ${req.channel}`);
      }
      const inserted = await client.query(
        `INSERT INTO notifications (user_id, channel, template_id, dedupe_key, payload, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING id`,
        [req.userId, req.channel, req.templateId, req.dedupeKey, req.payload],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query("SELECT id FROM notifications WHERE dedupe_key = $1", [req.dedupeKey]);
        await client.query("COMMIT");
        return { id: existing.rows[0].id, created: false };
      }
      const id = inserted.rows[0].id;
      await client.query(
        "INSERT INTO outbox (aggregate_id, topic, body) VALUES ($1, 'notification.created', $2)",
        [id, { id, channel: req.channel }],
      );
      await client.query("COMMIT");
      return { id, created: true };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
