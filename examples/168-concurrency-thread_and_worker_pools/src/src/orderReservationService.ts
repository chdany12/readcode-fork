import { BoundedPool, PoolSaturatedError } from "./workerPool";

export interface OrderLine {
  sku: string;
  quantity: number;
}

export interface InventoryClient {
  reserve(orderId: string, line: OrderLine, timeoutMs: number): Promise<{ reservationId: string }>;
  release(reservationId: string): Promise<void>;
}

export interface ReservationResult {
  orderId: string;
  reservations: string[];
  failedSkus: string[];
}

const RESERVE_TIMEOUT_MS = 2_000;

export class OrderReservationService {
  private readonly pool: BoundedPool;

  constructor(private readonly inventory: InventoryClient, concurrency = 8) {
    this.pool = new BoundedPool(concurrency, 500);
  }

  async reserveOrder(orderId: string, lines: OrderLine[]): Promise<ReservationResult> {
    const settled = await Promise.allSettled(
      lines.map((line) =>
        this.pool.submit(() => this.inventory.reserve(orderId, line, RESERVE_TIMEOUT_MS)),
      ),
    );

    const reservations: string[] = [];
    const failedSkus: string[] = [];
    let saturated = false;

    settled.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") {
        reservations.push(outcome.value.reservationId);
      } else {
        failedSkus.push(lines[i].sku);
        if (outcome.reason instanceof PoolSaturatedError) saturated = true;
      }
    });

    if (failedSkus.length > 0 && reservations.length > 0) {
      await Promise.allSettled(
        reservations.map((id) => this.pool.submit(() => this.inventory.release(id))),
      );
      return { orderId, reservations: [], failedSkus };
    }

    if (saturated) {
      throw new Error(`inventory reservation backlog full for order ${orderId}`);
    }

    return { orderId, reservations, failedSkus };
  }

  health() {
    return this.pool.stats;
  }
}
