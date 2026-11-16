import { Pool } from "pg";

export class ForbiddenError extends Error {}

export interface FeedItem {
  postId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export class FeedService {
  constructor(private readonly pool: Pool) {}

  async getFeed(viewerId: string, ownerId: string, limit = 20, before?: Date): Promise<FeedItem[]> {
    const blocked = await this.pool.query(
      "SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2",
      [ownerId, viewerId],
    );
    if (blocked.rowCount && blocked.rowCount > 0) {
      throw new ForbiddenError("viewer is blocked by owner");
    }
    const res = await this.pool.query(
      `SELECT p.id, p.author_id, p.body, p.created_at
         FROM posts p
         JOIN follows f ON f.followee_id = p.author_id
        WHERE f.follower_id = $1
          AND p.deleted_at IS NULL
          AND ($2::timestamptz IS NULL OR p.created_at < $2)
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $3`,
      [ownerId, before ?? null, limit],
    );
    return res.rows.map((r) => ({ postId: r.id, authorId: r.author_id, body: r.body, createdAt: r.created_at }));
  }
}
