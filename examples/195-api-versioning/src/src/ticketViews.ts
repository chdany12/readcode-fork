export type TicketStatusV2 = "new" | "open" | "pending_customer" | "on_hold" | "solved" | "closed";

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatusV2;
  priority: "low" | "normal" | "high" | "urgent";
  requesterEmail: string;
  assigneeId: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketV1 {
  id: string;
  subject: string;
  status: "open" | "pending" | "closed";
  priority: "low" | "normal" | "high";
  requester: string;
  assignee: string | null;
  created_at: string;
}

const V1_STATUS: Record<TicketStatusV2, TicketV1["status"]> = {
  new: "open",
  open: "open",
  pending_customer: "pending",
  on_hold: "pending",
  solved: "closed",
  closed: "closed",
};

export function toV1(t: Ticket): TicketV1 {
  return {
    id: t.id,
    subject: t.subject,
    status: V1_STATUS[t.status],
    priority: t.priority === "urgent" ? "high" : t.priority,
    requester: t.requesterEmail,
    assignee: t.assigneeId,
    created_at: t.createdAt.toISOString(),
  };
}

export function toV2(t: Ticket) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    requester: { email: t.requesterEmail },
    assigneeId: t.assigneeId,
    tags: t.tags,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
