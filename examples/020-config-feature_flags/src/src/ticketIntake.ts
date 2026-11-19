import { OrgFlagService, Org } from "./orgFlags";

export interface Ticket {
  id: string;
  orgId: string;
  subject: string;
  body: string;
  priority: "low" | "normal" | "urgent";
}

export interface AiTriage {
  suggestQueue(ticket: Ticket): Promise<{ queue: string; confidence: number }>;
}

export interface QueueRouter {
  assign(ticketId: string, queue: string, reason: string): Promise<void>;
}

const MIN_CONFIDENCE = 0.75;

export class TicketIntake {
  constructor(
    private readonly flags: OrgFlagService,
    private readonly triage: AiTriage,
    private readonly router: QueueRouter,
  ) {}

  async route(ticket: Ticket, org: Org): Promise<string> {
    if (ticket.priority === "urgent") {
      await this.router.assign(ticket.id, "tier2-urgent", "priority");
      return "tier2-urgent";
    }

    const aiEnabled = await this.flags.enabledFor("ai_triage", org);
    if (aiEnabled) {
      try {
        const s = await this.triage.suggestQueue(ticket);
        if (s.confidence >= MIN_CONFIDENCE) {
          await this.router.assign(ticket.id, s.queue, "ai_triage");
          return s.queue;
        }
      } catch {
        // fall through to rule-based routing
      }
    }

    const queue = this.ruleBasedQueue(ticket);
    await this.router.assign(ticket.id, queue, "rules");
    return queue;
  }

  private ruleBasedQueue(ticket: Ticket): string {
    const text = `${ticket.subject} ${ticket.body}`.toLowerCase();
    if (/(invoice|refund|charge)/.test(text)) return "billing";
    if (/(password|login|sso)/.test(text)) return "access";
    return "general";
  }
}
