import { randomUUID } from "crypto";
import { InboxShardRouter } from "./shardRouter";

export interface Notification {
  id: string;
  userId: string;
  kind: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export class InboxService {
  constructor(private readonly router: InboxShardRouter) {}

  async deliver(userId: string, kind: string, body: string): Promise<Notification> {
    const id = randomUUID();
    const pool = this.router.poolFor(userId);
    const { rows } = await pool.query(
      `INSERT INTO notifications (id, user_id, kind, body, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, user_id, kind, body, created_at, read_at`,
      [id, userId, kind, body],
    );
    return toNotification(rows[0]);
  }

  async list(userId: string, limit = 50): Promise<Notification[]> {
    const pool = this.router.poolFor(userId);
    const { rows } = await pool.query(
      `SELECT id, user_id, kind, body, created_at, read_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, Math.min(limit, 200)],
    );
    return rows.map(toNotification);
  }

  async unreadCount(userId: string): Promise<number> {
    const pool = this.router.poolFor(userId);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return rows[0].n;
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const pool = this.router.poolFor(notificationId);
    const { rowCount } = await pool.query(
      `UPDATE notifications SET read_at = now()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [notificationId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async purgeOlderThan(days: number): Promise<number> {
    let total = 0;
    for (const pool of this.router.all()) {
      const { rowCount } = await pool.query(
        `DELETE FROM notifications WHERE created_at < now() - ($1 || ' days')::interval`,
        [String(days)],
      );
      total += rowCount ?? 0;
    }
    return total;
  }
}

function toNotification(r: any): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}
