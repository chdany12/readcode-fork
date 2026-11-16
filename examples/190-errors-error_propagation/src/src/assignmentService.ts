import { Ticket, TicketRepository } from "./ticketRepository";

export class NotFoundError extends Error {
  readonly status = 404;
}
export class ConflictError extends Error {
  readonly status = 409;
}

export interface AgentDirectory {
  isActiveAgent(tenantId: string, agentId: string): Promise<boolean>;
}

export class AssignmentService {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly agents: AgentDirectory,
  ) {}

  async assign(tenantId: string, ticketId: string, agentId: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(tenantId, ticketId);
    if (!ticket) {
      throw new NotFoundError(`ticket ${ticketId} not found`);
    }
    if (ticket.status === "solved") {
      throw new ConflictError(`ticket ${ticketId} is already solved`);
    }
    if (!(await this.agents.isActiveAgent(tenantId, agentId))) {
      throw new ConflictError(`agent ${agentId} cannot take tickets`);
    }
    await this.tickets.assign(tenantId, ticketId, agentId);
    return { ...ticket, assigneeId: agentId };
  }
}
