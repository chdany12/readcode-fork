import { createHash } from "crypto";

export interface ShardClient {
  name: string;
  put(key: string, record: FileRecord): Promise<void>;
  get(key: string): Promise<FileRecord | null>;
  listByPrefix(prefix: string, limit: number): Promise<FileRecord[]>;
}

export interface FileRecord {
  ownerId: string;
  path: string;
  size: number;
  etag: string;
  updatedAt: number;
}

export class ShardMap {
  constructor(private readonly shards: ShardClient[]) {}

  forKey(partitionKey: string): ShardClient {
    const n = createHash("sha256").update(partitionKey).digest().readUInt32BE(0);
    return this.shards[n % this.shards.length];
  }
}
