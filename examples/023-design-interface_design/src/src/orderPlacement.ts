import { InventoryStore, InsufficientStockError, ReserveResult } from "./inventory";

export interface OrderLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderRepository {
  insert(order: {
    ref: string;
    customerId: string;
    lines: OrderLine[];
    reservationIds: string[];
    totalCents: number;
  }): Promise<void>;
}

export class OrderPlacementService {
  constructor(
    private readonly inventory: InventoryStore,
    private readonly orders: OrderRepository,
    private readonly newRef: () => string,
  ) {}

  async placeOrder(customerId: string, lines: OrderLine[]): Promise<string> {
    if (lines.length === 0) {
      throw new Error("order must contain at least one line");
    }
    const ref = this.newRef();
    const reservationIds: string[] = [];

    try {
      for (const line of lines) {
        const res: ReserveResult = await this.inventory.reserve(line.sku, line.quantity, ref);
        if (res.status === "insufficient") {
          throw new InsufficientStockError(res.sku, res.available);
        }
        const reserved = res as Extract<ReserveResult, { status: "reserved" }>;
        reservationIds.push(reserved.reservationId);
      }

      const totalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
      await this.orders.insert({ ref, customerId, lines, reservationIds, totalCents });
      return ref;
    } catch (err) {
      await this.releaseAll(reservationIds);
      throw err;
    }
  }

  private async releaseAll(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.inventory.release(id);
      } catch (releaseErr) {
        console.error(JSON.stringify({ msg: "release failed", reservationId: id, error: String(releaseErr) }));
      }
    }
  }
}
