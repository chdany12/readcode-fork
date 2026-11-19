import { createHash } from "crypto";

export interface FileChangeEvent {
  eventId: string;
  workspaceId: string;
  fileId: string;
  version: number;
  contentHash: string;
  deviceId: string;
  kind: "upsert" | "delete";
}

interface Entry {
  expiresAt: number;
}

export class ChangeDeduplicator {
  private readonly seen = new Map<string, Entry>();

  constructor(
    private readonly windowMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now
  ) {}

  private key(e: FileChangeEvent): string {
    return createHash("sha1")
      .update(`${e.workspaceId}|${e.fileId}|${e.kind}|${e.contentHash}`)
      .digest("hex");
  }

  isDuplicate(e: FileChangeEvent): boolean {
    this.evictExpired();
    const k = this.key(e);
    const entry = this.seen.get(k);
    return entry !== undefined && entry.expiresAt > this.now();
  }

  remember(e: FileChangeEvent): void {
    const k = this.key(e);
    this.seen.delete(k);
    this.seen.set(k, { expiresAt: this.now() + this.windowMs });
    while (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value as string;
      this.seen.delete(oldest);
    }
  }

  private evictExpired(): void {
    const t = this.now();
    for (const [k, v] of this.seen) {
      if (v.expiresAt > t) break;
      this.seen.delete(k);
    }
  }
}
