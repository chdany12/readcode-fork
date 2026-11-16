export type OrderStatus = "placed" | "accepted" | "preparing" | "ready" | "picked_up" | "delivered" | "cancelled";

export interface OrderStatusEvent {
  orderId: string;
  restaurantId: string;
  status: OrderStatus;
  version: number;
  emittedAt: string;
}

export interface OrderView {
  orderId: string;
  status: OrderStatus;
  version: number;
  updatedAt: string;
}

export interface OrderViewRepository {
  get(orderId: string): Promise<OrderView | null>;
  put(view: OrderView): Promise<void>;
}

export interface CustomerNotifier {
  statusChanged(orderId: string, status: OrderStatus): Promise<void>;
}
