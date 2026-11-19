import { Pool } from "pg";
import { lockFile, adjustUsage } from "./fileRepo";

export class FileVersionService {
  constructor(private readonly pool: Pool) {}

  async commitNewVersion(
    fileId: string,
    newSizeBytes: number,
    blobKey: string,
    checksum: string
  ): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const file = await lockFile(client, fileId);
      const delta = newSizeBytes - file.sizeBytes;

      if (delta !== 0) {
        await adjustUsage(this.pool, file.ownerId, delta);
      }

      const { rows } = await client.query(
        `INSERT INTO file_versions (file_id, version, blob_key, size_bytes, checksum, created_at)
         SELECT $1, coalesce(max(version), 0) + 1, $2, $3, $4, now()
           FROM file_versions WHERE file_id = $1
         RETURNING version`,
        [fileId, blobKey, newSizeBytes, checksum]
      );
      const version: number = rows[0].version;

      await client.query(
        `UPDATE files SET size_bytes = $2, current_version = $3, updated_at = now()
          WHERE id = $1`,
        [fileId, newSizeBytes, version]
      );
      await client.query(
        `INSERT INTO sync_journal (owner_id, file_id, version, op, created_at)
         VALUES ($1, $2, $3, 'update', now())`,
        [file.ownerId, fileId, version]
      );

      await client.query("COMMIT");
      return version;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async trash(fileId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const file = await lockFile(client, fileId);
      await client.query(`UPDATE files SET deleted_at = now() WHERE id = $1`, [fileId]);
      await adjustUsage(client, file.ownerId, -file.sizeBytes);
      await client.query(
        `INSERT INTO sync_journal (owner_id, file_id, version, op, created_at)
         VALUES ($1, $2, NULL, 'delete', now())`,
        [file.ownerId, fileId]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
