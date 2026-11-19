import { fromRow, TicketRow } from "./ticket";
import { toDto, applyPatch } from "./ticketDto";

export interface Db {
  findTicket(id: string): Promise<TicketRow | null>;
  updateTicket(row: TicketRow): Promise<void>;
}

export async function getTicket(db: Db, id: string): Promise<{ status: number; body: string }> {
  const row = await db.findTicket(id);
  if (!row) return { status: 404, body: JSON.stringify({ error: "not_found" }) };
  return { status: 200, body: JSON.stringify(toDto(fromRow(row))) };
}

export async function patchTicket(db: Db, id: string, rawBody: string) {
  const row = await db.findTicket(id);
  if (!row) return { status: 404, body: JSON.stringify({ error: "not_found" }) };
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: JSON.stringify({ error: "malformed_json" }) };
  }
  const updated = applyPatch(fromRow(row), body);
  await db.updateTicket({
    ...row,
    subject: updated.subject,
    assignee_id: updated.assigneeId,
    updated_at: updated.updatedAt,
    tags: [...updated.tags],
    custom_fields: Object.fromEntries(updated.customFields),
  });
  return { status: 200, body: JSON.stringify(toDto(updated)) };
}
