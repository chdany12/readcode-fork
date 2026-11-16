import { Pool } from "pg";

export class DispatchError extends Error {
  constructor(public readonly code: "NO_COURIER" | "BAD_STATE", message: string) {
    super(message);
  }
}

export class DispatchService {
  constructor(private readonly pool: Pool) {}

  async assignCourier(orderId: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const order = await client.query(
        "SELECT status, zone FROM orders WHERE id = $1 FOR UPDATE",
        [orderId],
      );
      if (order.rowCount === 0 || order.rows[0].status !== "ready_for_pickup") {
        throw new DispatchError("BAD_STATE", `order ${orderId} is not ready`);
      }
      const courier = await client.query(
        `SELECT id FROM couriers
          WHERE zone = $1 AND status = 'available'
          ORDER BY last_delivery_at NULLS FIRST
          LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [order.rows[0].zone],
      );
      if (courier.rowCount === 0) {
        throw new DispatchError("NO_COURIER", `no courier available in ${order.rows[0].zone}`);
      }
      const courierId: string = courier.rows[0].id;
      await client.query("UPDATE couriers SET status = 'busy' WHERE id = $1", [courierId]);
      await client.query(
        "UPDATE orders SET status = 'dispatched', courier_id = $2 WHERE id = $1",
        [orderId, courierId],
      );
      await client.query("COMMIT");
      return courierId;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
