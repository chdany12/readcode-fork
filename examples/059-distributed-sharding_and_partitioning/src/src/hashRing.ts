import { createHash } from "crypto";

export interface FeedNode {
  id: string;
  url: string;
}

interface VNode {
  point: number;
  node: FeedNode;
}

function hash32(input: string): number {
  return createHash("sha1").update(input).digest().readUInt32BE(0);
}

export class HashRing {
  private vnodes: VNode[] = [];

  constructor(nodes: FeedNode[], private readonly replicas = 128) {
    for (const n of nodes) this.add(n);
  }

  add(node: FeedNode): void {
    for (let i = 0; i < this.replicas; i++) {
      this.vnodes.push({ point: hash32(`${node.id}:${i}`), node });
    }
    this.vnodes.sort((a, b) => a.point - b.point);
  }

  remove(nodeId: string): void {
    this.vnodes = this.vnodes.filter((v) => v.node.id !== nodeId);
  }

  locate(key: string): FeedNode {
    if (this.vnodes.length === 0) throw new Error("ring is empty");
    const h = hash32(key);
    let lo = 0;
    let hi = this.vnodes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.vnodes[mid].point < h) lo = mid + 1;
      else hi = mid;
    }
    if (lo === this.vnodes.length) return this.vnodes[this.vnodes.length - 1].node;
    return this.vnodes[lo].node;
  }
}
