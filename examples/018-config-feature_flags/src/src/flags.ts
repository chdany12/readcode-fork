import { createHash } from "crypto";

export interface RolloutRule {
  enabled: boolean;
  percentage: number;
  allowUserIds?: string[];
  denyMarkets?: string[];
}

export interface FlagContext {
  userId: string;
  market: string;
}

export class FlagEvaluator {
  constructor(private rules: Map<string, RolloutRule>) {}

  replaceRules(next: Map<string, RolloutRule>): void {
    this.rules = next;
  }

  isEnabled(flag: string, ctx: FlagContext): boolean {
    const rule = this.rules.get(flag);
    if (!rule || !rule.enabled) {
      return false;
    }
    if (rule.allowUserIds?.includes(ctx.userId)) {
      return true;
    }
    if (rule.denyMarkets?.includes(ctx.market)) {
      return false;
    }
    return this.bucket(flag, ctx.userId) < rule.percentage;
  }

  private bucket(flag: string, userId: string): number {
    const seed = createHash("sha1").update(`${flag}:${userId}`).digest("hex");
    const jitter = Math.floor(Math.random() * 100);
    return (parseInt(seed.slice(0, 8), 16) + jitter) % 100;
  }
}
