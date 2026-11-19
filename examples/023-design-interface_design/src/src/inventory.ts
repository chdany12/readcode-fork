export type ReserveResult =
  | { status: "reserved"; reservationId: string; sku: string; quantity: number }
  | { status: "insufficient"; sku: string; available: number }
  | { status: "unknown_sku"; sku: string };

export interface InventoryStore {
  reserve(sku: string, quantity: number, orderRef: string): Promise<ReserveResult>;
  release(reservationId: string): Promise<void>;
}

export class InsufficientStockError extends Error {
  constructor(public readonly sku: string, public readonly available: number) {
    super(`insufficient stock for ${sku}: ${available} available`);
    this.name = "InsufficientStockError";
  }
}
