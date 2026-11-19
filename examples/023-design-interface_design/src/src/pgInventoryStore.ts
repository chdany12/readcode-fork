import { Pool } from "pg";
import { InventoryStore, ReserveResult } from "./inventory";

export class PgInventoryStore implements InventoryStore {
  constructor(private readonly pool: Pool) {}

  async reserve(sku: string, quantity: number, orderRef: string): Promise<ReserveResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await client.query(
        "SELECT on_hand - reserved AS available FROM stock WHERE sku = $1 FOR UPDATE",
        [sku],
      );
      if (row.rowCount === 0) {
        await client.query("ROLLBACK");
        return { status: "unknown_sku", sku };
      }
      const available = Number(row.rows[0].available);
      if (available < quantity) {
        await client.query("ROLLBACK");
        return { status: "insufficient", sku, available };
      }
      await client.query("UPDATE stock SET reserved = reserved + $2 WHERE sku = $1", [sku, quantity]);
      const ins = await client.query(
        "INSERT INTO reservations (sku, quantity, order_ref) VALUES ($1, $2, $3) RETURNING id",
        [sku, quantity, orderRef],
      );
      await client.query("COMMIT");
      return { status: "reserved", reservationId: String(ins.rows[0].id), sku, quantity };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async release(reservationId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const del = await client.query(
        "DELETE FROM reservations WHERE id = $1 RETURNING sku, quantity",
        [reservationId],
      );
      if (del.rowCount === 1) {
        const { sku, quantity } = del.rows[0];
        await client.query("UPDATE stock SET reserved = reserved - $2 WHERE sku = $1", [sku, quantity]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
