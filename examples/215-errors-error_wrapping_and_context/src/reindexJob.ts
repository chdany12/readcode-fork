import { ProductIndexer } from "./productIndexer";
import { IndexingError, isRetryable } from "./errors";

export interface Logger {
  info(msg: string, fields?: object): void;
  error(msg: string, fields?: object): void;
}

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runReindexJob(
  indexer: ProductIndexer,
  batches: Array<{ id: string; productIds: string[] }>,
  log: Logger,
): Promise<{ indexed: number; failed: string[] }> {
  let indexed = 0;
  const failed: string[] = [];

  for (const batch of batches) {
    for (let attempt = 1; ; attempt++) {
      try {
        indexed += await indexer.indexBatch(batch.id, batch.productIds);
        break;
      } catch (err) {
        const retry = isRetryable(err) && attempt < MAX_ATTEMPTS;
        log.error("batch indexing failed", {
          batchId: batch.id,
          attempt,
          willRetry: retry,
          error: err instanceof Error ? err.message : String(err),
          context: err instanceof IndexingError ? err.context : undefined,
        });
        if (!retry) {
          failed.push(batch.id);
          break;
        }
        await sleep(200 * 2 ** attempt);
      }
    }
  }

  log.info("reindex finished", { indexed, failed: failed.length });
  return { indexed, failed };
}
