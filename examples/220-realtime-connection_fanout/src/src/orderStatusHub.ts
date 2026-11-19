import { WebSocket } from "ws";

export type OrderStatus = "placed" | "accepted" | "preparing" | "ready" | "picked_up" | "delivered" | "cancelled";

export interface OrderEvent {
  orderId: string;
  restaurantId: string;
  customerId: string;
  status: OrderStatus;
  etaMinutes?: number;
  version: number;
}

const SLOW_CLIENT_BYTES = 512 * 1024;

export class OrderStatusHub {
  private byCustomer = new Map<string, Set<WebSocket>>();
  private byRestaurant = new Map<string, Set<WebSocket>>();
  private evictions = 0;

  attachCustomer(customerId: string, ws: WebSocket): void {
    this.attach(this.byCustomer, customerId, ws);
  }

  attachRestaurant(restaurantId: string, ws: WebSocket): void {
    this.attach(this.byRestaurant, restaurantId, ws);
  }

  private attach(index: Map<string, Set<WebSocket>>, key: string, ws: WebSocket): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(ws);
    ws.once("close", () => {
      const current = index.get(key);
      if (!current) return;
      current.delete(ws);
      if (current.size === 0) index.delete(key);
    });
  }

  dispatch(event: OrderEvent): void {
    const frame = JSON.stringify({ type: "order_status", ...event });
    this.sendToCustomer(event.customerId, frame);
    this.broadcastToRestaurant(event.restaurantId, frame);
  }

  private sendToCustomer(customerId: string, frame: string): void {
    const sockets = this.byCustomer.get(customerId);
    if (!sockets) return;
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > SLOW_CLIENT_BYTES) {
        this.evict(ws);
        continue;
      }
      ws.send(frame);
    }
  }

  private broadcastToRestaurant(restaurantId: string, frame: string): void {
    const sockets = this.byRestaurant.get(restaurantId);
    if (!sockets) return;
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      ws.send(frame);
    }
  }

  private evict(ws: WebSocket): void {
    this.evictions++;
    ws.close(4008, "too slow, please reconnect");
  }

  metrics() {
    let customerSockets = 0;
    let restaurantSockets = 0;
    for (const s of this.byCustomer.values()) customerSockets += s.size;
    for (const s of this.byRestaurant.values()) restaurantSockets += s.size;
    return { customerSockets, restaurantSockets, evictions: this.evictions };
  }
}
