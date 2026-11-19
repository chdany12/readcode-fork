import { Pool } from "pg";

export interface SearchIndexClient {
  upsert(tenantId: string, docs: IndexedDoc[]): Promise<void>;
}

export interface IndexedDoc {
  id: string;
  revision: number;
  title: string;
  body: string;
  tags: string[];
}

export class OutboxRelay {
  constructor(
    private readonly pool: Pool,
    private readonly search: SearchIndexClient,
    private readonly batchSize = 200
  ) {}

  async runOnce(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT o.id AS outbox_id, d.tenant_id, d.id, d.revision, d.title, d.body, d.tags
           FROM index_outbox o
           JOIN documents d ON d.id = o.document_id
          ORDER BY o.id
          LIMIT $1
          FOR UPDATE OF o SKIP LOCKED`,
        [this.batchSize]
      );
      if (rows.length === 0) {
        await client.query("COMMIT");
        return 0;
      }

      const byTenant = new Map<string, IndexedDoc[]>();
      for (const r of rows) {
        const list = byTenant.get(r.tenant_id) ?? [];
        list.push({ id: r.id, revision: r.revision, title: r.title, body: r.body, tags: r.tags });
        byTenant.set(r.tenant_id, list);
      }
      for (const [tenantId, docs] of byTenant) {
        await this.search.upsert(tenantId, docs);
      }

      await client.query(`DELETE FROM index_outbox WHERE id = ANY($1)`, [
        rows.map((r) => r.outbox_id),
      ]);
      await client.query("COMMIT");
      return rows.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
