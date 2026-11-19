import { createHash } from "crypto";

export interface FlagRule {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  allowTenants: string[];
  denyTenants: string[];
}

export interface EvalContext {
  userId: string;
  tenantId: string;
}

export class FlagEvaluator {
  private rules = new Map<string, FlagRule>();

  load(rules: FlagRule[]): void {
    const next = new Map<string, FlagRule>();
    for (const r of rules) {
      if (r.rolloutPercent < 0 || r.rolloutPercent > 100) {
        throw new RangeError(`flag ${r.key}: rolloutPercent out of range`);
      }
      next.set(r.key, r);
    }
    this.rules = next;
  }

  isEnabled(key: string, ctx: EvalContext): boolean {
    const flag = this.rules.get(key);
    if (!flag || !flag.enabled) return false;
    if (flag.denyTenants.includes(ctx.tenantId)) return false;
    if (flag.allowTenants.includes(ctx.tenantId)) return true;
    const bucket = this.bucketFor(flag.key, ctx.userId);
    return bucket <= flag.rolloutPercent;
  }

  private bucketFor(flagKey: string, userId: string): number {
    const digest = createHash("sha256").update(`${flagKey}:${userId}`).digest();
    return digest.readUInt32BE(0) % 100;
  }
}
