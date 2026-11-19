import { ShardMap, FileRecord } from "./shardMap";

function normalize(path: string): string {
  const parts = path.split("/").filter((p) => p.length > 0 && p !== ".");
  if (parts.some((p) => p === "..")) throw new Error(`invalid path: ${path}`);
  return "/" + parts.join("/");
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export class FileMetadataService {
  constructor(private readonly shards: ShardMap) {}

  private rowKey(ownerId: string, path: string): string {
    return `${ownerId}:${path}`;
  }

  async putFile(ownerId: string, rawPath: string, size: number, etag: string): Promise<FileRecord> {
    const path = normalize(rawPath);
    const record: FileRecord = { ownerId, path, size, etag, updatedAt: Date.now() };
    const shard = this.shards.forKey(this.rowKey(ownerId, path));
    await shard.put(this.rowKey(ownerId, path), record);
    return record;
  }

  async getFile(ownerId: string, rawPath: string): Promise<FileRecord | null> {
    const path = normalize(rawPath);
    const shard = this.shards.forKey(ownerId);
    return shard.get(this.rowKey(ownerId, path));
  }

  async listFolder(ownerId: string, rawFolder: string, limit = 500): Promise<FileRecord[]> {
    const folder = normalize(rawFolder);
    const prefix = this.rowKey(ownerId, folder === "/" ? "/" : folder + "/");
    const shard = this.shards.forKey(ownerId);
    const rows = await shard.listByPrefix(prefix, Math.min(limit, 1000));
    return rows.filter((r) => parentOf(r.path) === folder);
  }

  async syncSince(ownerId: string, cursor: number): Promise<{ changes: FileRecord[]; cursor: number }> {
    const shard = this.shards.forKey(ownerId);
    const rows = await shard.listByPrefix(this.rowKey(ownerId, "/"), 1000);
    const changes = rows.filter((r) => r.updatedAt > cursor).sort((a, b) => a.updatedAt - b.updatedAt);
    const next = changes.length ? changes[changes.length - 1].updatedAt : cursor;
    return { changes, cursor: next };
  }
}
