import { OrderStatusHub, OrderEvent } from "./orderStatusHub";

export interface EventSource {
  subscribe(topic: string, handler: (payload: string) => void): void;
}

export function wireOrderEvents(source: EventSource, hub: OrderStatusHub): void {
  const lastVersion = new Map<string, number>();

  source.subscribe("orders.status", (payload) => {
    let event: OrderEvent;
    try {
      event = JSON.parse(payload) as OrderEvent;
    } catch {
      return;
    }
    const seen = lastVersion.get(event.orderId) ?? -1;
    if (event.version <= seen) return;
    lastVersion.set(event.orderId, event.version);
    hub.dispatch(event);
    if (event.status === "delivered" || event.status === "cancelled") {
      lastVersion.delete(event.orderId);
    }
  });
}
