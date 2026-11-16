import { SlidingWindowLimiter } from "./slidingWindowLimiter";

export interface PlaceOrderInput {
  customerId: string;
  items: { sku: string; quantity: number }[];
}

export interface InventoryService {
  reserve(orderId: string, items: PlaceOrderInput["items"]): Promise<boolean>;
}

export interface OrderRepo {
  create(customerId: string, items: PlaceOrderInput["items"]): Promise<string>;
  markRejected(orderId: string, reason: string): Promise<void>;
}

type Response = { status: number; headers: Record<string, string>; body: unknown };

const perCustomer = new SlidingWindowLimiter({
  limit: 5,
  windowMs: 60_000,
  maxTrackedKeys: 100_000,
});

export async function placeOrder(
  input: PlaceOrderInput,
  orders: OrderRepo,
  inventory: InventoryService,
): Promise<Response> {
  if (input.items.length === 0 || input.items.some((i) => i.quantity <= 0)) {
    return { status: 422, headers: {}, body: { error: "invalid_items" } };
  }

  const verdict = perCustomer.check(input.customerId);
  if (!verdict.ok) {
    return {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(verdict.retryAfterMs / 1000)) },
      body: { error: "too_many_orders" },
    };
  }

  const orderId = await orders.create(input.customerId, input.items);
  const reserved = await inventory.reserve(orderId, input.items);
  if (!reserved) {
    await orders.markRejected(orderId, "out_of_stock");
    return { status: 409, headers: {}, body: { error: "out_of_stock", orderId } };
  }

  return {
    status: 201,
    headers: { "X-RateLimit-Remaining": String(verdict.remaining) },
    body: { orderId },
  };
}
