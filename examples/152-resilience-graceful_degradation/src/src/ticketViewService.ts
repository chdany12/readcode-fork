import { optional, withTimeout } from "./degrade";

export interface Ticket {
  id: string;
  subject: string;
  customerId: string;
  status: "open" | "pending" | "solved";
  messages: { author: string; body: string; at: string }[];
}

export interface CustomerProfile {
  name: string;
  plan: "free" | "pro" | "enterprise";
  slaHours: number | null;
}

export interface Deps {
  tickets: { get(id: string, signal: AbortSignal): Promise<Ticket | null> };
  crm: { profile(customerId: string, signal: AbortSignal): Promise<CustomerProfile> };
  kb: { suggest(text: string, signal: AbortSignal): Promise<{ title: string; url: string }[]> };
  metrics: { increment(name: string, tags: Record<string, string>): void };
}

export interface TicketView {
  ticket: Ticket;
  customer: CustomerProfile | null;
  suggestions: { title: string; url: string }[];
  degraded: string[];
}

export class TicketViewService {
  constructor(private readonly deps: Deps) {}

  private readonly onDegraded = (label: string, err: unknown) => {
    this.deps.metrics.increment("ticket_view.degraded", {
      dependency: label,
      reason: err instanceof Error ? err.name : "unknown",
    });
  };

  async load(ticketId: string): Promise<TicketView | null> {
    const ticket = await withTimeout("tickets", 2000, (s) => this.deps.tickets.get(ticketId, s));
    if (!ticket) return null;

    const lastCustomerMessage =
      [...ticket.messages].reverse().find((m) => m.author === ticket.customerId)?.body ?? ticket.subject;

    const [customer, suggestions] = await Promise.all([
      optional<CustomerProfile | null>("crm", 800, null, (s) => this.deps.crm.profile(ticket.customerId, s), this.onDegraded),
      optional("kb", 600, [], (s) => this.deps.kb.suggest(lastCustomerMessage, s), this.onDegraded),
    ]);

    const degraded = [customer, suggestions].length
      ? (["crm", "kb"] as const).filter((_, i) => [customer, suggestions][i].degraded)
      : [];

    return {
      ticket,
      customer: customer.value,
      suggestions: suggestions.value,
      degraded: [...degraded],
    };
  }

  slaDeadline(view: TicketView, openedAt: Date): Date | null {
    const hours = view.customer?.slaHours ?? 4;
    return new Date(openedAt.getTime() + hours * 3_600_000);
  }
}
