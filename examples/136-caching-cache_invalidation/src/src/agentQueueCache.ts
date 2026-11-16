import { Redis } from "ioredis";

export interface TicketSummary {
  id: string;
  subject: string;
  status: "open" | "pending" | "solved";
  priority: "low" | "normal" | "urgent";
  assigneeId: string | null;
  updatedAt: string;
}

const QUEUE_TTL_SECONDS = 120;

export class AgentQueueCache {
  constructor(private readonly redis: Redis) {}

  private key(agentId: string): string {
    return `agent-queue:${agentId}`;
  }

  async get(agentId: string): Promise<TicketSummary[] | null> {
    const raw = await this.redis.get(this.key(agentId));
    return raw ? (JSON.parse(raw) as TicketSummary[]) : null;
  }

  async put(agentId: string, tickets: TicketSummary[]): Promise<void> {
    await this.redis.set(this.key(agentId), JSON.stringify(tickets), "EX", QUEUE_TTL_SECONDS);
  }

  async invalidate(...agentIds: Array<string | null>): Promise<void> {
    const keys = agentIds.filter((id): id is string => id !== null).map((id) => this.key(id));
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
