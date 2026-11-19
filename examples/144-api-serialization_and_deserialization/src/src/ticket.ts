export type Priority = "low" | "normal" | "high" | "urgent";

export interface Ticket {
  id: string;
  subject: string;
  priority: Priority;
  requesterEmail: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Set<string>;
  customFields: Map<string, string>;
}

export interface TicketRow {
  id: string;
  subject: string;
  priority: string;
  requester_email: string;
  assignee_id: string | null;
  created_at: Date;
  updated_at: Date;
  tags: string[];
  custom_fields: Record<string, string> | null;
}

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export function fromRow(row: TicketRow): Ticket {
  const priority = PRIORITIES.includes(row.priority as Priority) ? (row.priority as Priority) : "normal";
  return {
    id: row.id,
    subject: row.subject,
    priority,
    requesterEmail: row.requester_email,
    assigneeId: row.assignee_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: new Set(row.tags),
    customFields: new Map(Object.entries(row.custom_fields ?? {})),
  };
}
