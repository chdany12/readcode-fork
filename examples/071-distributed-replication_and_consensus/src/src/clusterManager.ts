import { InventoryNode, NodeStatus } from "./inventoryNode";

export interface FailoverConfig {
  heartbeatTimeoutMs: number;
  maxAcceptableLagOffsets: number;
}

export class InventoryClusterManager {
  private primary: InventoryNode;
  private failoverInProgress = false;

  constructor(
    initialPrimary: InventoryNode,
    private readonly followers: InventoryNode[],
    private readonly config: FailoverConfig,
  ) {
    this.primary = initialPrimary;
  }

  currentPrimary(): InventoryNode {
    return this.primary;
  }

  async checkHealth(): Promise<void> {
    if (this.failoverInProgress) return;
    this.failoverInProgress = true;
    try {
      const status = await this.safeStatus(this.primary);
      if (status && Date.now() - status.lastHeartbeatAt < this.config.heartbeatTimeoutMs) return;
      await this.failover();
    } finally {
      this.failoverInProgress = false;
    }
  }

  private async failover(): Promise<void> {
    const statuses = await Promise.all(
      this.followers.map(async (node) => ({ node, status: await this.safeStatus(node) })),
    );
    const candidates = statuses.filter(
      (s): s is { node: InventoryNode; status: NodeStatus } =>
        s.status !== null && Date.now() - s.status.lastHeartbeatAt < this.config.heartbeatTimeoutMs,
    );
    if (candidates.length === 0) {
      throw new Error("no healthy follower available for promotion");
    }

    candidates.sort((a, b) => b.status.lastHeartbeatAt - a.status.lastHeartbeatAt);
    const chosen = candidates[0];

    const highestOffset = Math.max(...candidates.map((c) => c.status.appliedOffset));
    if (highestOffset - chosen.status.appliedOffset > this.config.maxAcceptableLagOffsets) {
      console.warn("promoting follower behind peers", { node: chosen.node.id, highestOffset });
    }

    const oldPrimary = this.primary;
    const newEpoch = Math.max(...candidates.map((c) => c.status.epoch)) + 1;
    await oldPrimary.fence(newEpoch).catch(() => undefined);
    await chosen.node.promote(newEpoch);

    this.primary = chosen.node;
    const remaining = this.followers.filter((f) => f !== chosen.node);
    remaining.push(oldPrimary);
    this.followers.splice(0, this.followers.length, ...remaining);

    await Promise.all(
      this.followers.map((f) => f.followPrimary(chosen.node.id, newEpoch).catch(() => undefined)),
    );
  }

  private async safeStatus(node: InventoryNode): Promise<NodeStatus | null> {
    try {
      return await node.status();
    } catch {
      return null;
    }
  }
}
