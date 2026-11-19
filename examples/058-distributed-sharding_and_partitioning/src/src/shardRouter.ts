import { createHash } from "crypto";
import { Pool } from "pg";

export class InboxShardRouter {
  constructor(private readonly pools: Pool[]) {
    if (pools.length === 0) throw new Error("at least one shard required");
  }

  shardIndex(key: string): number {
    const digest = createHash("md5").update(key).digest();
    return digest.readUInt32BE(0) % this.pools.length;
  }

  poolFor(userId: string): Pool {
    return this.pools[this.shardIndex(userId)];
  }

  all(): Pool[] {
    return this.pools;
  }
}
