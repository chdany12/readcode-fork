import { ShardRouter } from "./shardRouter";

export interface OrderRow {
  id: string;
  restaurant_id: string;
  customer_id: string;
  status: string;
  total_cents: number;
  created_at: Date;
}

export class OrderRepository {
  constructor(private readonly router: ShardRouter) {}

  async create(order: Omit<OrderRow, "created_at">): Promise<void> {
    await this.router.poolFor(order.restaurant_id).query(
      `INSERT INTO orders (id, restaurant_id, customer_id, status, total_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.id, order.restaurant_id, order.customer_id, order.status, order.total_cents],
    );
  }

  async activeForRestaurant(restaurantId: string): Promise<OrderRow[]> {
    const { rows } = await this.router.poolFor(restaurantId).query<OrderRow>(
      `SELECT * FROM orders
       WHERE restaurant_id = $1 AND status IN ('placed', 'preparing', 'ready')
       ORDER BY created_at`,
      [restaurantId],
    );
    return rows;
  }

  async recentForCustomer(customerId: string, limit = 20): Promise<OrderRow[]> {
    const perShard = await Promise.all(
      this.router.all().map((pool) =>
        pool
          .query<OrderRow>(
            `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [customerId, limit],
          )
          .then((r) => r.rows),
      ),
    );
    return perShard
      .flat()
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }
}
