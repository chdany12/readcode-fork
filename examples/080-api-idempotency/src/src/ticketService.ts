import { Pool } from "pg";

export interface NewTicket {
  subject: string;
  description: string;
  requesterEmail: string;
  priority: "low" | "normal" | "high" | "urgent";
}

export interface Ticket {
  id: string;
  number: number;
  status: "open";
}

export class TicketService {
  constructor(private readonly db: Pool, private readonly notify: (t: Ticket, email: string) => Promise<void>) {}

  async create(tenantId: string, input: NewTicket): Promise<Ticket> {
    const { rows } = await this.db.query(
      `INSERT INTO tickets (tenant_id, number, subject, description, requester_email, priority, status)
       VALUES ($1, (SELECT coalesce(max(number), 0) + 1 FROM tickets WHERE tenant_id = $1), $2, $3, $4, $5, 'open')
       RETURNING id, number, status`,
      [tenantId, input.subject, input.description, input.requesterEmail, input.priority]
    );
    const ticket: Ticket = rows[0];
    await this.notify(ticket, input.requesterEmail);
    return ticket;
  }
}
