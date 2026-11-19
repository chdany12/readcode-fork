export interface ChunkRef {
  index: number;
  sha256: string;
  size: number;
}

export interface BlobStore {
  putChunk(fileId: string, chunk: ChunkRef, data: Buffer, signal: AbortSignal): Promise<void>;
  commitFile(fileId: string, chunks: ChunkRef[], signal: AbortSignal): Promise<{ version: number }>;
}

export class DeadlineExceededError extends Error {
  constructor(public readonly stage: string) {
    super(`sync deadline exceeded during ${stage}`);
  }
}

export async function withTimeout<T>(
  ms: number,
  stage: string,
  op: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (ms <= 0) throw new DeadlineExceededError(stage);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await op(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new DeadlineExceededError(stage);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
