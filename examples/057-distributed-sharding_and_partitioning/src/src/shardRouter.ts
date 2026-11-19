import { Pool } from "pg";

export interface ShardConfig {
  id: number;
  connectionString: string;
}

export function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export class ShardRouter {
  private readonly pools: Pool[];

  constructor(shards: ShardConfig[]) {
    if (shards.length === 0) throw new Error("at least one shard is required");
    this.pools = [...shards]
      .sort((a, b) => a.id - b.id)
      .map((s) => new Pool({ connectionString: s.connectionString, max: 10 }));
  }

  get shardCount(): number {
    return this.pools.length;
  }

  shardFor(restaurantId: string): number {
    return hashKey(restaurantId) % this.pools.length;
  }

  poolFor(restaurantId: string): Pool {
    return this.pools[this.shardFor(restaurantId)];
  }

  all(): Pool[] {
    return this.pools;
  }

  async close(): Promise<void> {
    await Promise.all(this.pools.map((p) => p.end()));
  }
}
