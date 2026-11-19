import { Pool } from "pg";
import { withTransaction } from "./tx";

export class PinLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`profile already has ${limit} pinned posts`);
  }
}

export class PostNotFoundError extends Error {}

const MAX_PINNED = 3;

export class PinnedPostService {
  constructor(private readonly pool: Pool) {}

  async pin(authorId: string, postId: string): Promise<void> {
    await withTransaction(this.pool, "SERIALIZABLE", async (client) => {
      const post = await client.query(
        `SELECT id, pinned FROM posts WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
        [postId, authorId]
      );
      if (post.rowCount === 0) throw new PostNotFoundError(postId);
      if (post.rows[0].pinned) return;

      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM posts
          WHERE author_id = $1 AND pinned = true AND deleted_at IS NULL`,
        [authorId]
      );
      if (rows[0].n >= MAX_PINNED) throw new PinLimitError(MAX_PINNED);

      await client.query(
        `UPDATE posts SET pinned = true, pinned_at = now() WHERE id = $1`,
        [postId]
      );
      await client.query(
        `INSERT INTO feed_events (author_id, post_id, kind, created_at)
         VALUES ($1, $2, 'pinned', now())`,
        [authorId, postId]
      );
    });
  }

  async unpin(authorId: string, postId: string): Promise<void> {
    await withTransaction(this.pool, "SERIALIZABLE", async (client) => {
      const { rowCount } = await client.query(
        `UPDATE posts SET pinned = false, pinned_at = NULL
          WHERE id = $1 AND author_id = $2 AND pinned = true`,
        [postId, authorId]
      );
      if (rowCount === 0) return;
      await client.query(
        `INSERT INTO feed_events (author_id, post_id, kind, created_at)
         VALUES ($1, $2, 'unpinned', now())`,
        [authorId, postId]
      );
    });
  }

  async listPinned(authorId: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT id FROM posts
        WHERE author_id = $1 AND pinned = true AND deleted_at IS NULL
        ORDER BY pinned_at DESC`,
      [authorId]
    );
    return rows.map((r) => r.id);
  }
}
