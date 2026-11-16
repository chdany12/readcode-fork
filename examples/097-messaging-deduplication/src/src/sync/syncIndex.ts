import type { Pool } from "pg";
import type { FileChangeEvent } from "./dedup";

export class SyncIndex {
  constructor(private readonly pool: Pool) {}

  async applyIfNewer(e: FileChangeEvent): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `INSERT INTO file_index (workspace_id, file_id, version, content_hash, deleted)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, file_id) DO UPDATE
         SET version = EXCLUDED.version,
             content_hash = EXCLUDED.content_hash,
             deleted = EXCLUDED.deleted
       WHERE file_index.version < EXCLUDED.version`,
      [e.workspaceId, e.fileId, e.version, e.contentHash, e.kind === "delete"]
    );
    return (rowCount ?? 0) > 0;
  }
}
