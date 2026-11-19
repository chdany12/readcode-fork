import { EventEmitter } from "events";

export interface StockRepo {
  available(sku: string): Promise<number>;
  decrement(sku: string, qty: number): Promise<boolean>;
}

export class StockUnavailableError extends Error {
  constructor(public readonly sku: string, public readonly qty: number) {
    super(`stock unavailable for ${sku} x${qty}`);
  }
}

export class InventoryWaiter {
  private readonly events = new EventEmitter();

  constructor(private readonly repo: StockRepo) {
    this.events.setMaxListeners(0);
  }

  notifyRestock(sku: string): void {
    this.events.emit(`restock:${sku}`);
  }

  async reserve(sku: string, qty: number, waitMs: number): Promise<void> {
    if (await this.repo.decrement(sku, qty)) return;

    await new Promise<void>((resolve, reject) => {
      const channel = `restock:${sku}`;
      let settled = false;

      const onRestock = async () => {
        if (settled) return;
        try {
          if (await this.repo.decrement(sku, qty)) {
            settled = true;
            clearTimeout(timer);
            this.events.off(channel, onRestock);
            resolve();
          }
        } catch (err) {
          settled = true;
          clearTimeout(timer);
          this.events.off(channel, onRestock);
          reject(err);
        }
      };

      const timer = setTimeout(() => {
        settled = true;
        reject(new StockUnavailableError(sku, qty));
      }, waitMs);

      this.events.on(channel, onRestock);
    });
  }

  pendingWaiters(sku: string): number {
    return this.events.listenerCount(`restock:${sku}`);
  }
}
