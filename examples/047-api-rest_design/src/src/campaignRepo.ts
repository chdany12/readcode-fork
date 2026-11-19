import { randomUUID } from "node:crypto";

export type CampaignStatus = "draft" | "active" | "paused" | "archived";

export interface Campaign {
  id: string;
  advertiserId: string;
  name: string;
  status: CampaignStatus;
  dailyBudgetCents: number;
  updatedAt: Date;
}

export class CampaignRepo {
  private rows = new Map<string, Campaign>();

  async listByAdvertiser(advertiserId: string, status?: CampaignStatus): Promise<Campaign[]> {
    return [...this.rows.values()].filter(
      (c) => c.advertiserId === advertiserId && c.status !== "archived" && (!status || c.status === status),
    );
  }

  async create(advertiserId: string, name: string, dailyBudgetCents: number): Promise<Campaign> {
    const c: Campaign = {
      id: randomUUID(),
      advertiserId,
      name,
      status: "draft",
      dailyBudgetCents,
      updatedAt: new Date(),
    };
    this.rows.set(c.id, c);
    return c;
  }

  async get(id: string): Promise<Campaign | undefined> {
    const c = this.rows.get(id);
    return c && c.status !== "archived" ? c : undefined;
  }

  async update(id: string, patch: Partial<Pick<Campaign, "status" | "dailyBudgetCents">>): Promise<Campaign | undefined> {
    const c = await this.get(id);
    if (!c) return undefined;
    const next = { ...c, ...patch, updatedAt: new Date() };
    this.rows.set(id, next);
    return next;
  }

  async archive(id: string): Promise<boolean> {
    const c = await this.get(id);
    if (!c) return false;
    this.rows.set(id, { ...c, status: "archived", updatedAt: new Date() });
    return true;
  }
}
