import { AgentQueueCache, TicketSummary } from "./agentQueueCache";

export interface TicketRepo {
  find(id: string): Promise<TicketSummary | null>;
  openForAgent(agentId: string): Promise<TicketSummary[]>;
  update(id: string, patch: Partial<Pick<TicketSummary, "status" | "priority" | "assigneeId">>): Promise<TicketSummary>;
}

export class NotFoundError extends Error {}

export class TicketService {
  constructor(private readonly repo: TicketRepo, private readonly queues: AgentQueueCache) {}

  async agentQueue(agentId: string): Promise<TicketSummary[]> {
    const cached = await this.queues.get(agentId);
    if (cached) return cached;
    const tickets = await this.repo.openForAgent(agentId);
    tickets.sort((a, b) => {
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (b.priority === "urgent" && a.priority !== "urgent") return 1;
      return a.updatedAt.localeCompare(b.updatedAt);
    });
    await this.queues.put(agentId, tickets);
    return tickets;
  }

  async reassign(ticketId: string, newAgentId: string): Promise<TicketSummary> {
    const ticket = await this.repo.find(ticketId);
    if (!ticket) throw new NotFoundError(`ticket ${ticketId} not found`);
    if (ticket.assigneeId === newAgentId) return ticket;

    const updated = await this.repo.update(ticketId, { assigneeId: newAgentId });
    await this.queues.invalidate(updated.assigneeId);
    return updated;
  }

  async setStatus(ticketId: string, status: TicketSummary["status"]): Promise<TicketSummary> {
    const updated = await this.repo.update(ticketId, { status });
    await this.queues.invalidate(updated.assigneeId);
    return updated;
  }

  async escalate(ticketId: string): Promise<TicketSummary> {
    const updated = await this.repo.update(ticketId, { priority: "urgent" });
    await this.queues.invalidate(updated.assigneeId);
    return updated;
  }
}
