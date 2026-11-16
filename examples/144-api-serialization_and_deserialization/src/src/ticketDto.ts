import { Ticket } from "./ticket";

export interface TicketDto {
  id: string;
  subject: string;
  priority: string;
  requester: { email: string };
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  customFields: Record<string, string>;
}

export function toDto(ticket: Ticket): TicketDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    priority: ticket.priority,
    requester: { email: ticket.requesterEmail },
    assigneeId: ticket.assigneeId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    tags: [...ticket.tags].sort(),
    customFields: ticket.customFields as unknown as Record<string, string>,
  };
}

export function applyPatch(ticket: Ticket, body: unknown): Ticket {
  if (typeof body !== "object" || body === null) throw new Error("invalid body");
  const b = body as Record<string, unknown>;
  const next: Ticket = {
    ...ticket,
    tags: new Set(ticket.tags),
    customFields: new Map(ticket.customFields),
  };
  if (typeof b.subject === "string" && b.subject.trim()) next.subject = b.subject.trim();
  if (b.assigneeId === null || typeof b.assigneeId === "string") next.assigneeId = b.assigneeId;
  if (Array.isArray(b.addTags)) {
    for (const t of b.addTags) if (typeof t === "string") next.tags.add(t.toLowerCase());
  }
  if (b.customFields && typeof b.customFields === "object") {
    for (const [k, v] of Object.entries(b.customFields as Record<string, unknown>)) {
      if (v === null) next.customFields.delete(k);
      else if (typeof v === "string") next.customFields.set(k, v);
    }
  }
  next.updatedAt = new Date();
  return next;
}
