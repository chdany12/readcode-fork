import { ShardLocks } from "./shardLocks";

export interface IndexedDoc {
  id: string;
  tenantId: string;
  terms: string[];
  updatedAt: number;
}

export interface ShardStorage {
  load(shardId: string, docId: string): Promise<IndexedDoc | undefined>;
  write(shardId: string, doc: IndexedDoc): Promise<void>;
  remove(shardId: string, docId: string): Promise<void>;
  listDocIds(shardId: string): Promise<string[]>;
}

export class ShardedIndex {
  private readonly locks = new ShardLocks();

  constructor(
    private readonly storage: ShardStorage,
    private readonly shardCount: number,
  ) {}

  shardFor(docId: string): string {
    let h = 0;
    for (const ch of docId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `shard-${String(h % this.shardCount).padStart(3, "0")}`;
  }

  async upsert(doc: IndexedDoc): Promise<void> {
    const shard = this.shardFor(doc.id);
    await this.locks.withShard(shard, async () => {
      const existing = await this.storage.load(shard, doc.id);
      if (existing && existing.updatedAt > doc.updatedAt) return;
      await this.storage.write(shard, doc);
    });
  }

  async moveDocument(docId: string, fromShard: string, toShard: string): Promise<boolean> {
    if (fromShard === toShard) return false;
    return this.locks.withShard(fromShard, () =>
      this.locks.withShard(toShard, async () => {
        const doc = await this.storage.load(fromShard, docId);
        if (!doc) return false;
        await this.storage.write(toShard, doc);
        await this.storage.remove(fromShard, docId);
        return true;
      }),
    );
  }

  async mergeShards(sourceShards: string[], target: string): Promise<number> {
    return this.locks.withShards([...sourceShards, target], async () => {
      let moved = 0;
      for (const src of sourceShards) {
        if (src === target) continue;
        for (const id of await this.storage.listDocIds(src)) {
          const doc = await this.storage.load(src, id);
          if (!doc) continue;
          const current = await this.storage.load(target, id);
          if (!current || current.updatedAt < doc.updatedAt) {
            await this.storage.write(target, doc);
          }
          await this.storage.remove(src, id);
          moved++;
        }
      }
      return moved;
    });
  }
}
