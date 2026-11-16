import { createHash } from "crypto";

export interface PercentFlag {
  key: string;
  rolloutPercent: number;
  killSwitch: boolean;
}

export interface FlagConfigLoader {
  load(): Promise<PercentFlag[]>;
}

export class BillingFlags {
  private flags = new Map<string, PercentFlag>();

  constructor(private readonly loader: FlagConfigLoader) {}

  async reload(): Promise<void> {
    const list = await this.loader.load();
    const next = new Map<string, PercentFlag>();
    for (const f of list) {
      if (f.rolloutPercent < 0 || f.rolloutPercent > 100) {
        throw new Error(`invalid rolloutPercent ${f.rolloutPercent} for ${f.key}`);
      }
      next.set(f.key, f);
    }
    this.flags = next;
  }

  isEnabledForAccount(key: string, accountId: string): boolean {
    const f = this.flags.get(key);
    if (!f || f.killSwitch) {
      return false;
    }
    return bucketOf(key, accountId) <= f.rolloutPercent;
  }
}

export function bucketOf(key: string, accountId: string): number {
  const digest = createHash("sha256").update(`${key}/${accountId}`).digest();
  return digest.readUInt32BE(0) % 100;
}
