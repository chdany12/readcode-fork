import { Pool } from "pg";

export interface Ticket {
  id: string;
  tenantId: string;
  subject: string;
  status: "open" | "pending" | "solved";
  assigneeId: string | null;
}

export class TicketRepository {
  constructor(private readonly pool: Pool) {}

  async findById(tenantId: string, ticketId: string): Promise<Ticket | null> {
    try {
      const { rows } = await this.pool.query(
        `SELECT id, tenant_id, subject, status, assignee_id
           FROM tickets WHERE tenant_id = $1 AND id = $2`,
        [tenantId, ticketId],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        subject: r.subject,
        status: r.status,
        assigneeId: r.assignee_id,
      };
    } catch (err) {
      console.error("ticket lookup failed", { tenantId, ticketId, err });
      return null;
    }
  }

  async assign(tenantId: string, ticketId: string, agentId: string): Promise<void> {
    const res = await this.pool.query(
      `UPDATE tickets SET assignee_id = $3, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, ticketId, agentId],
    );
    if (res.rowCount === 0) {
      throw new Error(`ticket ${ticketId} vanished during assignment`);
    }
  }
}
