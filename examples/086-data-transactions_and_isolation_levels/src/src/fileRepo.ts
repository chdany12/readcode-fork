import { Pool, PoolClient } from "pg";

export interface FileRow {
  id: string;
  ownerId: string;
  folderId: string;
  sizeBytes: number;
}

export class QuotaExceededError extends Error {
  constructor(public readonly ownerId: string) {
    super(`storage quota exceeded for ${ownerId}`);
  }
}

export class FileNotFoundError extends Error {}

export async function lockFile(client: PoolClient, fileId: string): Promise<FileRow> {
  const { rows } = await client.query(
    `SELECT id, owner_id, folder_id, size_bytes FROM files
      WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [fileId]
  );
  if (rows.length === 0) throw new FileNotFoundError(fileId);
  const r = rows[0];
  return { id: r.id, ownerId: r.owner_id, folderId: r.folder_id, sizeBytes: Number(r.size_bytes) };
}

export async function adjustUsage(
  db: Pool | PoolClient,
  ownerId: string,
  deltaBytes: number
): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE storage_usage SET used_bytes = used_bytes + $2
      WHERE owner_id = $1 AND used_bytes + $2 <= quota_bytes`,
    [ownerId, deltaBytes]
  );
  if (rowCount === 0) throw new QuotaExceededError(ownerId);
}
