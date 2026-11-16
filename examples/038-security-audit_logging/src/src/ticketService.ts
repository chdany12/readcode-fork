import { TicketAuditLogger, AuditContext } from "./auditLog";

export interface Ticket {
  id: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  assigneeId: string | null;
  queue: string;
  updatedAt: string;
}

export interface TicketRepo {
  findById(id: string): Promise<Ticket | null>;
  save(ticket: Ticket): Promise<void>;
}

export class TicketNotFoundError extends Error {}
export class ForbiddenTransitionError extends Error {}

const ALLOWED: Record<Ticket["status"], Ticket["status"][]> = {
  open: ["pending", "resolved"],
  pending: ["open", "resolved"],
  resolved: ["open", "closed"],
  closed: [],
};

export class TicketService {
  constructor(private readonly repo: TicketRepo, private readonly audit: TicketAuditLogger) {}

  async changeStatus(ctx: AuditContext, ticketId: string, next: Ticket["status"]): Promise<Ticket> {
    const ticket = await this.load(ticketId);
    if (!ALLOWED[ticket.status].includes(next)) {
      throw new ForbiddenTransitionError(`${ticket.status} -> ${next}`);
    }
    return this.apply(ctx, "ticket.status_changed", ticket, { status: next });
  }

  async reassign(ctx: AuditContext, ticketId: string, assigneeId: string, queue?: string): Promise<Ticket> {
    const ticket = await this.load(ticketId);
    const patch: Partial<Ticket> = { assigneeId };
    if (queue) patch.queue = queue;
    return this.apply(ctx, "ticket.reassigned", ticket, patch);
  }

  async escalate(ctx: AuditContext, ticketId: string): Promise<Ticket> {
    const ticket = await this.load(ticketId);
    if (ticket.priority === "urgent") return ticket;
    const order: Ticket["priority"][] = ["low", "normal", "high", "urgent"];
    const next = order[order.indexOf(ticket.priority) + 1];
    return this.apply(ctx, "ticket.priority_changed", ticket, { priority: next });
  }

  private async apply(
    ctx: AuditContext,
    action: "ticket.status_changed" | "ticket.reassigned" | "ticket.priority_changed",
    ticket: Ticket,
    patch: Partial<Ticket>,
  ): Promise<Ticket> {
    const before = ticket;
    Object.assign(ticket, patch, { updatedAt: new Date().toISOString() });
    await this.repo.save(ticket);
    await this.audit.record(ctx, action, ticket.id, { ...before }, { ...ticket });
    return ticket;
  }

  private async load(ticketId: string): Promise<Ticket> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw new TicketNotFoundError(ticketId);
    return ticket;
  }
}
