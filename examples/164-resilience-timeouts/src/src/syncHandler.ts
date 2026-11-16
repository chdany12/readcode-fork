import { FileSyncUploader } from "./uploader";
import { DeadlineExceededError } from "./blobStore";

export interface SyncRequest {
  fileId: string;
  contents: Buffer;
  clientDeadlineMs?: number;
}

const DEFAULT_BUDGET_MS = 60_000;
const MAX_BUDGET_MS = 300_000;

export async function handleSync(uploader: FileSyncUploader, req: SyncRequest) {
  const budget = Math.min(req.clientDeadlineMs ?? DEFAULT_BUDGET_MS, MAX_BUDGET_MS);
  try {
    const result = await uploader.sync(req.fileId, req.contents, budget);
    return { status: 200, body: result };
  } catch (err) {
    if (err instanceof DeadlineExceededError) {
      return { status: 504, body: { error: "sync_deadline_exceeded", stage: err.stage } };
    }
    throw err;
  }
}
