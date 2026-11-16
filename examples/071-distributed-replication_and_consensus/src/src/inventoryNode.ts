export interface NodeStatus {
  role: "primary" | "follower" | "fenced";
  epoch: number;
  appliedOffset: number;
  lastHeartbeatAt: number;
}

export interface StockMutation {
  sku: string;
  delta: number;
  orderId: string;
}

export interface InventoryNode {
  readonly id: string;
  status(): Promise<NodeStatus>;
  promote(epoch: number): Promise<void>;
  fence(epoch: number): Promise<void>;
  followPrimary(primaryId: string, epoch: number): Promise<void>;
  apply(mutation: StockMutation, epoch: number): Promise<number>;
}

export class StaleEpochError extends Error {}

export async function reserveStock(
  primary: InventoryNode,
  epoch: number,
  sku: string,
  quantity: number,
  orderId: string,
): Promise<number> {
  if (quantity <= 0) throw new Error("quantity must be positive");
  try {
    return await primary.apply({ sku, delta: -quantity, orderId }, epoch);
  } catch (err) {
    if (err instanceof StaleEpochError) {
      throw new Error(`primary ${primary.id} was fenced; retry against new primary`);
    }
    throw err;
  }
}
