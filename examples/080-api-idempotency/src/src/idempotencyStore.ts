import { Pool } from "pg";

export interface StoredResponse {
  status: number;
  body: unknown;
}

export class IdempotencyStore {
  constructor(private readonly db: Pool) {}

  async find(tenantId: string, key: string): Promise<{ fingerprint: string; response: StoredResponse } | null> {
    const { rows } = await this.db.query(
      `SELECT fingerprint, response_status, response_body
         FROM idempotency_keys
        WHERE tenant_id = $1 AND key = $2 AND created_at > now() - interval '24 hours'`,
      [tenantId, key]
    );
    if (rows.length === 0) return null;
    return {
      fingerprint: rows[0].fingerprint,
      response: { status: rows[0].response_status, body: rows[0].response_body },
    };
  }

  async save(tenantId: string, key: string, fingerprint: string, response: StoredResponse): Promise<void> {
    await this.db.query(
      `INSERT INTO idempotency_keys (tenant_id, key, fingerprint, response_status, response_body, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, key) DO UPDATE
         SET fingerprint = EXCLUDED.fingerprint,
             response_status = EXCLUDED.response_status,
             response_body = EXCLUDED.response_body,
             created_at = now()`,
      [tenantId, key, fingerprint, response.status, JSON.stringify(response.body)]
    );
  }
}
