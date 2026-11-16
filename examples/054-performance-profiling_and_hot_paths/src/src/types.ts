export type Priority = "urgent" | "high" | "normal" | "low";

export interface Ticket {
  id: string;
  priority: Priority;
  createdAt: number;
  firstResponseAt: number | null;
  pausedMs?: number;
  assigneeId: string | null;
}

export interface TicketStore {
  listOpenTickets(): Promise<Ticket[]>;
  listEscalatedTicketIds(): Promise<string[]>;
  listOnShiftAgentIds(): Promise<string[]>;
  markEscalated(ids: string[]): Promise<void>;
}

export interface Notifier {
  escalate(tickets: Ticket[]): Promise<void>;
}
