import { Pool } from "pg";
import { EncryptedField, FieldCipher } from "./fieldCipher";

export interface Ticket {
  id: string;
  customerEmail: string;
  subject: string;
  body: string;
  status: "open" | "pending" | "closed";
}

interface TicketRow {
  id: string;
  customer_email_enc: EncryptedField;
  subject: string;
  body_enc: EncryptedField;
  status: Ticket["status"];
}

export class TicketRepository {
  constructor(private readonly db: Pool, private readonly cipher: FieldCipher) {}

  async create(ticket: Ticket): Promise<void> {
    const [email, body] = await Promise.all([
      this.cipher.encrypt(ticket.id, ticket.customerEmail),
      this.cipher.encrypt(ticket.id, ticket.body),
    ]);
    await this.db.query(
      `INSERT INTO tickets (id, customer_email_enc, subject, body_enc, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticket.id, email, ticket.subject, body, ticket.status],
    );
  }

  async updateBody(ticketId: string, newBody: string): Promise<void> {
    const body = await this.cipher.encrypt(ticketId, newBody);
    const res = await this.db.query("UPDATE tickets SET body_enc = $2 WHERE id = $1", [ticketId, body]);
    if (res.rowCount === 0) throw new Error(`ticket ${ticketId} not found`);
  }

  async get(ticketId: string): Promise<Ticket | null> {
    const res = await this.db.query<TicketRow>(
      "SELECT id, customer_email_enc, subject, body_enc, status FROM tickets WHERE id = $1",
      [ticketId],
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    const [customerEmail, body] = await Promise.all([
      this.cipher.decrypt(row.id, row.customer_email_enc),
      this.cipher.decrypt(row.id, row.body_enc),
    ]);
    return { id: row.id, customerEmail, subject: row.subject, body, status: row.status };
  }
}
