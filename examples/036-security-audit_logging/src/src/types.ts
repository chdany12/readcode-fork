export interface Booking {
  id: string;
  travelerId: string;
  status: "confirmed" | "cancelled" | "refunded";
  totalCents: number;
  refundedCents: number;
  notes: string[];
}

export interface AuditRecord {
  bookingId: string;
  agentId: string;
  action: string;
  before: Pick<Booking, "status" | "refundedCents">;
  after: Pick<Booking, "status" | "refundedCents">;
  at: Date;
}

export interface BookingStore {
  load(id: string): Promise<Booking | null>;
  saveWithAudit(booking: Booking, record: AuditRecord): Promise<void>;
}
