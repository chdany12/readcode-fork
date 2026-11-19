import { Pool, PoolClient } from "pg";

export interface DocumentUpdate {
  documentId: string;
  tenantId: string;
  title: string;
  body: string;
  tags: string[];
}

export class StaleDocumentError extends Error {
  constructor(public readonly documentId: string) {
    super(`document ${documentId} was modified concurrently`);
  }
}

export class DocumentWriter {
  constructor(private readonly pool: Pool) {}

  async save(update: DocumentUpdate, expectedRevision: number): Promise<number> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows, rowCount } = await client.query(
        `UPDATE documents
            SET title = $3, body = $4, tags = $5, revision = revision + 1, updated_at = now()
          WHERE id = $1 AND tenant_id = $2 AND revision = $6
          RETURNING revision`,
        [update.documentId, update.tenantId, update.title, update.body, update.tags, expectedRevision]
      );
      if (rowCount === 0) {
        throw new StaleDocumentError(update.documentId);
      }
      const revision: number = rows[0].revision;

      await client.query(
        `INSERT INTO index_outbox (tenant_id, document_id, revision, op, enqueued_at)
         VALUES ($1, $2, $3, 'upsert', now())`,
        [update.tenantId, update.documentId, revision]
      );
      await client.query("COMMIT");
      client.release();
      return revision;
    } catch (err) {
      client.release();
      throw err;
    }
  }
}
