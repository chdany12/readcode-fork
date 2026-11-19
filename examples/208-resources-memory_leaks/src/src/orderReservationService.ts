import { InventoryWaiter, StockUnavailableError } from "./inventoryWaiter";

export interface OrderLine {
  sku: string;
  qty: number;
}

export interface OrderStore {
  markReserved(orderId: string): Promise<void>;
  markBackordered(orderId: string, sku: string): Promise<void>;
}

export class OrderReservationService {
  constructor(
    private readonly waiter: InventoryWaiter,
    private readonly orders: OrderStore,
    private readonly holdMs = 30_000,
  ) {}

  async reserveOrder(orderId: string, lines: OrderLine[]): Promise<boolean> {
    for (const line of lines) {
      try {
        await this.waiter.reserve(line.sku, line.qty, this.holdMs);
      } catch (err) {
        if (err instanceof StockUnavailableError) {
          await this.orders.markBackordered(orderId, err.sku);
          return false;
        }
        throw err;
      }
    }
    await this.orders.markReserved(orderId);
    return true;
  }
}
