import { listSnapshotFiles, readSnapshot, FareSnapshot, SnapshotTooLargeError } from "./snapshotReader";

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
}

export interface FareIndex {
  replaceSupplier(supplier: string, fares: FareSnapshot["fares"], generatedAt: string): void;
}

export interface LoadResult {
  loaded: number;
  skipped: string[];
}

export class FareSnapshotLoader {
  private running = false;

  constructor(
    private readonly dir: string,
    private readonly index: FareIndex,
    private readonly log: Logger,
  ) {}

  async loadAll(): Promise<LoadResult> {
    if (this.running) {
      this.log.info("fare snapshot load already in progress");
      return { loaded: 0, skipped: [] };
    }
    this.running = true;
    const result: LoadResult = { loaded: 0, skipped: [] };
    try {
      const files = await listSnapshotFiles(this.dir);
      for (const file of files) {
        try {
          const snap = await readSnapshot(file);
          this.index.replaceSupplier(snap.supplier, snap.fares, snap.generatedAt);
          result.loaded++;
        } catch (err) {
          if (err instanceof SnapshotTooLargeError) {
            this.log.warn("skipping oversized fare snapshot", { file, size: err.size });
          } else {
            this.log.warn("failed to load fare snapshot", { file, error: String(err) });
          }
          result.skipped.push(file);
        }
      }
      this.log.info("fare snapshots loaded", { ...result, skipped: result.skipped.length });
      return result;
    } finally {
      this.running = false;
    }
  }

  startPolling(intervalMs: number): () => void {
    const timer = setInterval(() => {
      void this.loadAll();
    }, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }
}
