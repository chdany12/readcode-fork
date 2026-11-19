import type { Pool } from "pg";
import { decodeCursor, encodeCursor } from "./cursor";

export interface DirectoryUser {
  id: string;
  email: string;
  displayName: string;
  status: "active" | "suspended";
  createdAt: string;
}

export interface UserPage {
  users: DirectoryUser[];
  nextCursor: string | null;
}

const MAX_LIMIT = 200;

export class UserDirectoryRepository {
  constructor(private readonly db: Pool) {}

  async listUsers(orgId: string, opts: { limit?: number; cursor?: string; status?: string }): Promise<UserPage> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), MAX_LIMIT);
    const params: unknown[] = [orgId];
    const where: string[] = ["org_id = $1"];

    if (opts.status) {
      params.push(opts.status);
      where.push(`status = $${params.length}`);
    }

    if (opts.cursor) {
      const c = decodeCursor(opts.cursor);
      params.push(c.createdAt, c.id);
      where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    params.push(limit + 1);
    const sql = `
      SELECT id, email, display_name, status, created_at
      FROM directory_users
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}`;

    const { rows } = await this.db.query(sql, params);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const users: DirectoryUser[] = pageRows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    const last = users[users.length - 1];
    return {
      users,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }
}
