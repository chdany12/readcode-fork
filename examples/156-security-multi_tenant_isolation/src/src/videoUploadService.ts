import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ObjectStore } from "./objectStore";

export interface UploadTicket {
  videoId: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: Date;
}

export class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const MAX_BYTES = 10 * 1024 ** 3;

export class VideoUploadService {
  constructor(private readonly db: Pool, private readonly store: ObjectStore) {}

  async begin(tenantId: string, title: string): Promise<UploadTicket> {
    const videoId = randomUUID();
    const objectKey = `${tenantId}/raw/${videoId}.mp4`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.db.query(
      `INSERT INTO videos (id, tenant_id, title, status, object_key)
       VALUES ($1, $2, $3, 'uploading', $4)`,
      [videoId, tenantId, title, objectKey],
    );
    const uploadUrl = await this.store.presignPut(objectKey, expiresAt);
    return { videoId, objectKey, uploadUrl, expiresAt };
  }

  async complete(tenantId: string, videoId: string, objectKey: string): Promise<void> {
    if (!objectKey.startsWith(tenantId)) {
      throw new UploadError("object key outside tenant namespace", 403);
    }
    const head = await this.store.head(objectKey);
    if (!head) throw new UploadError("object not found", 404);
    if (head.size > MAX_BYTES) throw new UploadError("object too large", 413);

    const res = await this.db.query(
      `UPDATE videos
          SET status = 'processing', object_key = $3, size_bytes = $4
        WHERE id = $1 AND tenant_id = $2 AND status = 'uploading'`,
      [videoId, tenantId, objectKey, head.size],
    );
    if (res.rowCount === 0) throw new UploadError("no pending upload for this video", 409);
    await this.store.enqueueTranscode({ tenantId, videoId, objectKey });
  }
}
