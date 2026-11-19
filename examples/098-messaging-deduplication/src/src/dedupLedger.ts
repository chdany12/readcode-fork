export interface KeyValueStore {
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export type ClaimResult = "claimed" | "in_progress" | "done";

const PROCESSING = "processing";
const DONE = "done";

export class DedupLedger {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly namespace: string,
    private readonly processingTtlSeconds: number,
    private readonly doneTtlSeconds: number,
  ) {}

  private key(messageId: string): string {
    return `${this.namespace}:dedup:${messageId}`;
  }

  async claim(messageId: string): Promise<ClaimResult> {
    const k = this.key(messageId);
    const acquired = await this.kv.setIfAbsent(k, PROCESSING, this.processingTtlSeconds);
    if (acquired) return "claimed";
    const state = await this.kv.get(k);
    if (state === DONE) return "done";
    if (state === null) {
      const retry = await this.kv.setIfAbsent(k, PROCESSING, this.processingTtlSeconds);
      return retry ? "claimed" : "in_progress";
    }
    return "in_progress";
  }

  async complete(messageId: string): Promise<void> {
    await this.kv.set(this.key(messageId), DONE, this.doneTtlSeconds);
  }

  async release(messageId: string): Promise<void> {
    await this.kv.delete(this.key(messageId));
  }
}
