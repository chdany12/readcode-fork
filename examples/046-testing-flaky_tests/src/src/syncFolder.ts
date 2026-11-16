import { createHash } from "node:crypto";

export interface LocalFile {
  path: string;
  bytes: Buffer;
}

export interface BlobStore {
  has(digest: string): Promise<boolean>;
  put(digest: string, bytes: Buffer): Promise<void>;
}

export interface SyncResult {
  uploaded: string[];
  skipped: string[];
}

export function digestOf(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function syncFolder(
  files: LocalFile[],
  store: BlobStore,
  concurrency = 4,
): Promise<SyncResult> {
  const result: SyncResult = { uploaded: [], skipped: [] };
  const queue = [...files];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const file = queue.shift()!;
      const digest = digestOf(file.bytes);
      if (await store.has(digest)) {
        result.skipped.push(file.path);
        continue;
      }
      await store.put(digest, file.bytes);
      result.uploaded.push(file.path);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
  await Promise.all(workers);
  return result;
}
