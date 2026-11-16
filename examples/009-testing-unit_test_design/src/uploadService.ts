export class QuotaExceededError extends Error {
  constructor(readonly accountId: string, readonly requested: number, readonly remaining: number) {
    super(`account ${accountId} needs ${requested} bytes, ${remaining} remaining`);
    this.name = "QuotaExceededError";
  }
}

export interface QuotaStore {
  usedBytes(accountId: string): Promise<number>;
  limitBytes(accountId: string): Promise<number>;
  addUsage(accountId: string, delta: number): Promise<void>;
}

export interface BlobStore {
  put(key: string, data: Uint8Array): Promise<{ etag: string }>;
  delete(key: string): Promise<void>;
}

export interface UploadResult {
  key: string;
  etag: string;
  size: number;
}

export class UploadService {
  constructor(private readonly quotas: QuotaStore, private readonly blobs: BlobStore) {}

  async upload(accountId: string, path: string, data: Uint8Array): Promise<UploadResult> {
    if (data.byteLength === 0) {
      throw new Error("refusing to store empty file");
    }
    const [used, limit] = await Promise.all([
      this.quotas.usedBytes(accountId),
      this.quotas.limitBytes(accountId),
    ]);
    const remaining = limit - used;
    if (data.byteLength > remaining) {
      throw new QuotaExceededError(accountId, data.byteLength, remaining);
    }

    const key = `${accountId}/${path.replace(/^\/+/, "")}`;
    const { etag } = await this.blobs.put(key, data);
    try {
      await this.quotas.addUsage(accountId, data.byteLength);
    } catch (err) {
      await this.blobs.delete(key);
      throw err;
    }
    return { key, etag, size: data.byteLength };
  }
}
