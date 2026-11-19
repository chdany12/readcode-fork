import { TenantDb } from "./tenantDb";

export interface FileEntry {
  path: string;
  revision: number;
  sha256: string;
  sizeBytes: number;
  updatedAt: Date;
}

export class ConflictError extends Error {
  constructor(readonly path: string, readonly currentRevision: number) {
    super(`revision conflict on ${path}`);
  }
}

export class SyncService {
  constructor(private readonly db: TenantDb) {}

  async changesSince(tenantId: string, since: Date, limit = 500): Promise<FileEntry[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query(
        `SELECT path, revision, sha256, size_bytes, updated_at
           FROM files
          WHERE updated_at > $1
          ORDER BY updated_at, path
          LIMIT $2`,
        [since, limit],
      );
      return res.rows.map((r) => ({
        path: r.path,
        revision: Number(r.revision),
        sha256: r.sha256,
        sizeBytes: Number(r.size_bytes),
        updatedAt: r.updated_at,
      }));
    });
  }

  async commit(tenantId: string, path: string, baseRevision: number, sha256: string, sizeBytes: number): Promise<number> {
    return this.db.withTenant(tenantId, async (client) => {
      if (baseRevision === 0) {
        const ins = await client.query(
          `INSERT INTO files (tenant_id, path, sha256, size_bytes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, path) DO NOTHING
           RETURNING revision`,
          [tenantId, path, sha256, sizeBytes],
        );
        if (ins.rowCount === 1) return Number(ins.rows[0].revision);
      } else {
        const upd = await client.query(
          `UPDATE files
              SET revision = revision + 1, sha256 = $3, size_bytes = $4, updated_at = now()
            WHERE path = $1 AND revision = $2
            RETURNING revision`,
          [path, baseRevision, sha256, sizeBytes],
        );
        if (upd.rowCount === 1) return Number(upd.rows[0].revision);
      }
      const cur = await client.query("SELECT revision FROM files WHERE path = $1", [path]);
      throw new ConflictError(path, cur.rowCount ? Number(cur.rows[0].revision) : 0);
    });
  }
}
