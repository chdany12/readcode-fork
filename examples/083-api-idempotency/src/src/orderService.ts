import { Pool } from "pg";
import { IdempotencyStore, StoredResponse, hashRequest } from "./idempotencyStore";

export interface OrderLine {
  sku: string;
  quantity: number;
}

export interface CreateOrderRequest {
  customerId: string;
  idempotencyKey: string;
  lines: OrderLine[];
}

export class InsufficientStockError extends Error {
  constructor(public readonly sku: string) {
    super(`insufficient stock for ${sku}`);
  }
}

export class OrderService {
  constructor(
    private readonly pool: Pool,
    private readonly idempotency: IdempotencyStore
  ) {}

  async createOrder(req: CreateOrderRequest): Promise<StoredResponse> {
    const requestHash = hashRequest(req.lines);
    const existing = await this.idempotency.find(req.customerId, req.idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return { status: 422, body: { error: "idempotency_key_reused" } };
      }
      return existing.response!;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const line of req.lines) {
        const { rowCount } = await client.query(
          `UPDATE inventory SET available = available - $1
            WHERE sku = $2 AND available >= $1`,
          [line.quantity, line.sku]
        );
        if (rowCount === 0) throw new InsufficientStockError(line.sku);
      }
      const { rows } = await client.query(
        `INSERT INTO orders (customer_id, status, created_at)
         VALUES ($1, 'placed', now()) RETURNING id`,
        [req.customerId]
      );
      const orderId: string = rows[0].id;
      for (const line of req.lines) {
        await client.query(
          `INSERT INTO order_lines (order_id, sku, quantity) VALUES ($1, $2, $3)`,
          [orderId, line.sku, line.quantity]
        );
      }
      const response: StoredResponse = { status: 201, body: { orderId } };
      await this.idempotency.save(client, req.customerId, req.idempotencyKey, requestHash, response);
      await client.query("COMMIT");
      return response;
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof InsufficientStockError) {
        return { status: 409, body: { error: "insufficient_stock", sku: err.sku } };
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
