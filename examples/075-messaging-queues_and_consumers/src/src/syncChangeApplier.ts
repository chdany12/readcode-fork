import { ChangeQueue, ChangeEnvelope } from "./changeQueue";
import { BlobStore, MetadataIndex } from "./storage";

export class SyncChangeApplier {
  private active = true;

  constructor(
    private readonly queue: ChangeQueue,
    private readonly blobs: BlobStore,
    private readonly index: MetadataIndex,
    private readonly parallelism = 8,
  ) {}

  shutdown(): void {
    this.active = false;
  }

  async run(): Promise<void> {
    while (this.active) {
      const envelopes = await this.queue.pull(this.parallelism);
      if (envelopes.length === 0) continue;
      await Promise.allSettled(envelopes.map((e) => this.applyOne(e)));
    }
  }

  private async applyOne(env: ChangeEnvelope): Promise<void> {
    const change = env.change;
    const current = await this.index.get(change.workspaceId, change.path);

    if (current && current.revision >= change.revision) {
      await this.queue.ack(env.leaseId);
      return;
    }

    try {
      await this.queue.ack(env.leaseId);
      if (change.kind === "delete") {
        await this.index.markDeleted(change.workspaceId, change.path, change.revision);
        await this.blobs.scheduleGc(change.contentHash);
      } else {
        const exists = await this.blobs.has(change.contentHash);
        if (!exists) {
          throw new Error(`blob ${change.contentHash} not yet uploaded`);
        }
        await this.index.upsert({
          workspaceId: change.workspaceId,
          path: change.path,
          revision: change.revision,
          contentHash: change.contentHash,
          size: change.size,
        });
      }
    } catch (err) {
      console.error("sync change failed", {
        workspaceId: change.workspaceId,
        path: change.path,
        revision: change.revision,
        error: err instanceof Error ? err.message : err,
      });
      if (env.attempt >= 5) {
        await this.queue.deadLetter(env.leaseId);
      } else {
        await this.queue.release(env.leaseId, 2_000 * env.attempt);
      }
    }
  }
}
