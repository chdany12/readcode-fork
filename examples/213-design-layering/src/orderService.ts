import { OrderRepository, Order, OrderLine } from "./orderRepository";
import { InventoryRepository } from "./inventoryRepository";
import { Db } from "./db";

export class OrderNotFoundError extends Error {}
export class InvalidOrderStateError extends Error {}
export class OutOfStockError extends Error {}

const CANCELLABLE = new Set(["pending", "paid"]);

export class OrderService {
  constructor(
    private readonly db: Db,
    private readonly orders: OrderRepository,
    private readonly inventory: InventoryRepository,
  ) {}

  async placeOrder(customerId: string, lines: OrderLine[]): Promise<Order> {
    return this.db.transaction(async (tx) => {
      for (const line of lines) {
        const reserved = await this.inventory.reserve(tx, line.sku, line.quantity);
        if (!reserved) throw new OutOfStockError(`insufficient stock for ${line.sku}`);
      }
      return this.orders.insert(tx, { customerId, lines, status: "pending" });
    });
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new OrderNotFoundError(`order ${id} not found`);
    return order;
  }

  async cancelOrder(id: string): Promise<Order> {
    return this.db.transaction(async (tx) => {
      const order = await this.orders.findByIdForUpdate(tx, id);
      if (!order) throw new OrderNotFoundError(`order ${id} not found`);
      if (!CANCELLABLE.has(order.status)) {
        throw new InvalidOrderStateError(`cannot cancel order in status ${order.status}`);
      }
      for (const line of order.lines) {
        await this.inventory.release(tx, line.sku, line.quantity);
      }
      await this.orders.updateStatus(order.id, "cancelled", tx);
      return { ...order, status: "cancelled" };
    });
  }
}
