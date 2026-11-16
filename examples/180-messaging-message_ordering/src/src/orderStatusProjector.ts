import { CustomerNotifier, OrderStatusEvent, OrderView, OrderViewRepository } from "./model";

const TERMINAL = new Set(["delivered", "cancelled"]);

export class OrderStatusProjector {
  constructor(private readonly repo: OrderViewRepository, private readonly notifier: CustomerNotifier) {}

  async apply(event: OrderStatusEvent): Promise<boolean> {
    const existing = await this.repo.get(event.orderId);

    if (existing && TERMINAL.has(existing.status)) {
      return false;
    }
    if (existing && event.version <= existing.version) {
      return false;
    }

    const view: OrderView = {
      orderId: event.orderId,
      status: event.status,
      version: event.version,
      updatedAt: event.emittedAt,
    };
    await this.repo.put(view);
    await this.notifier.statusChanged(event.orderId, event.status);
    return true;
  }
}
