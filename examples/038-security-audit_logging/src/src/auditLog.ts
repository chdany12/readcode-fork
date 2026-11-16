import { randomUUID } from "crypto";

export type AuditAction =
  | "ticket.reassigned"
  | "ticket.status_changed"
  | "ticket.priority_changed"
  | "ticket.merged";

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  ticketId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  requestId: string;
}

export interface AuditSink {
  append(entry: AuditEntry): Promise<void>;
}

export interface AuditContext {
  actorId: string;
  actorRole: string;
  requestId: string;
}

export class TicketAuditLogger {
  constructor(private readonly sink: AuditSink, private readonly now: () => Date = () => new Date()) {}

  async record(
    ctx: AuditContext,
    action: AuditAction,
    ticketId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditEntry = {
      id: randomUUID(),
      at: this.now().toISOString(),
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
      action,
      ticketId,
      before: pickChanged(before, after),
      after: pickChanged(after, before),
      requestId: ctx.requestId,
    };
    await this.sink.append(entry);
  }
}

function pickChanged(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(a)) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      out[key] = a[key];
    }
  }
  return out;
}
