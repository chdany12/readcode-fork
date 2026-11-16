import { createHash } from "crypto";
import { BlobStore, ChunkRef, withTimeout } from "./blobStore";

const CHUNK_SIZE = 4 * 1024 * 1024;
const PER_CHUNK_CAP_MS = 15_000;

export interface SyncResult {
  fileId: string;
  version: number;
  uploadedChunks: number;
  skippedChunks: number;
}

export class FileSyncUploader {
  constructor(
    private readonly store: BlobStore,
    private readonly knownChunks: (fileId: string) => Promise<Set<string>>,
  ) {}

  async sync(fileId: string, contents: Buffer, budgetMs: number): Promise<SyncResult> {
    const startedAt = Date.now();
    const deadlineAt = startedAt + budgetMs;
    const existing = await this.knownChunks(fileId);

    const chunks: ChunkRef[] = [];
    let uploaded = 0;
    let skipped = 0;

    for (let offset = 0, index = 0; offset < contents.length; offset += CHUNK_SIZE, index++) {
      const data = contents.subarray(offset, offset + CHUNK_SIZE);
      const ref: ChunkRef = {
        index,
        sha256: createHash("sha256").update(data).digest("hex"),
        size: data.length,
      };
      chunks.push(ref);

      if (existing.has(ref.sha256)) {
        skipped++;
        continue;
      }

      const remaining = deadlineAt - startedAt;
      await withTimeout(Math.min(remaining, PER_CHUNK_CAP_MS), `chunk ${index}`, (signal) =>
        this.store.putChunk(fileId, ref, data, signal),
      );
      uploaded++;
    }

    const { version } = await withTimeout(deadlineAt - Date.now(), "commit", (signal) =>
      this.store.commitFile(fileId, chunks, signal),
    );

    return { fileId, version, uploadedChunks: uploaded, skippedChunks: skipped };
  }
}
