import { Db, Tx } from "./db";

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";
export interface OrderLine { sku: string; quantity: number; }
export interface Order { id: string; customerId: string; lines: OrderLine[]; status: OrderStatus; }

export class OrderRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Order | null> {
    const rows = await this.db.query("SELECT id, customer_id, lines, status FROM orders WHERE id = $1", [id]);
    return rows[0] ? this.toOrder(rows[0]) : null;
  }

  async findByIdForUpdate(tx: Tx, id: string): Promise<Order | null> {
    const rows = await tx.query("SELECT id, customer_id, lines, status FROM orders WHERE id = $1 FOR UPDATE", [id]);
    return rows[0] ? this.toOrder(rows[0]) : null;
  }

  async insert(tx: Tx, o: Omit<Order, "id">): Promise<Order> {
    const rows = await tx.query(
      "INSERT INTO orders (customer_id, lines, status) VALUES ($1, $2, $3) RETURNING id, customer_id, lines, status",
      [o.customerId, JSON.stringify(o.lines), o.status],
    );
    return this.toOrder(rows[0]);
  }

  async updateStatus(id: string, status: OrderStatus, tx?: Tx): Promise<void> {
    await (tx ?? this.db).query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
  }

  private toOrder(row: any): Order {
    return { id: row.id, customerId: row.customer_id, lines: row.lines, status: row.status };
  }
}
