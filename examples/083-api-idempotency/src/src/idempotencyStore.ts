import { Pool, PoolClient } from "pg";
import { createHash } from "crypto";

export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyRecord {
  key: string;
  customerId: string;
  requestHash: string;
  response: StoredResponse | null;
  createdAt: Date;
}

export function hashRequest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export class IdempotencyStore {
  constructor(private readonly pool: Pool) {}

  async find(customerId: string, key: string): Promise<IdempotencyRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT key, customer_id, request_hash, response, created_at
         FROM idempotency_keys
        WHERE customer_id = $1 AND key = $2`,
      [customerId, key]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      key: r.key,
      customerId: r.customer_id,
      requestHash: r.request_hash,
      response: r.response,
      createdAt: r.created_at,
    };
  }

  async save(
    client: PoolClient,
    customerId: string,
    key: string,
    requestHash: string,
    response: StoredResponse
  ): Promise<void> {
    await client.query(
      `INSERT INTO idempotency_keys (customer_id, key, request_hash, response, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [customerId, key, requestHash, JSON.stringify(response)]
    );
  }
}
