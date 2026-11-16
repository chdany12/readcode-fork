export interface OrgTargetedFlag {
  key: string;
  enabled: boolean;
  allowedOrgs: string;
  plans: Array<"free" | "team" | "enterprise">;
}

export interface Org {
  id: string;
  plan: "free" | "team" | "enterprise";
}

export interface FlagRepository {
  get(key: string): Promise<OrgTargetedFlag | null>;
}

export class OrgFlagService {
  private cache = new Map<string, { flag: OrgTargetedFlag | null; at: number }>();

  constructor(
    private readonly repo: FlagRepository,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  async enabledFor(key: string, org: Org): Promise<boolean> {
    const flag = await this.load(key);
    if (!flag || !flag.enabled) {
      return false;
    }
    if (flag.allowedOrgs.trim() === "*") {
      return flag.plans.includes(org.plan);
    }
    return flag.allowedOrgs.includes(org.id);
  }

  private async load(key: string): Promise<OrgTargetedFlag | null> {
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) {
      return hit.flag;
    }
    const flag = await this.repo.get(key);
    this.cache.set(key, { flag, at: this.now() });
    return flag;
  }
}
