import { AuditRecord, Booking, BookingStore } from "./types";

export interface Agent {
  id: string;
  permissions: Set<string>;
}

export class RefundError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "RefundError";
  }
}

const snapshot = (b: Booking) => ({ status: b.status, refundedCents: b.refundedCents });

export class ManualRefundService {
  constructor(
    private readonly store: BookingStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issueRefund(
    agent: Agent,
    bookingId: string,
    amountCents: number,
    reason: string,
  ): Promise<Booking> {
    if (!agent.permissions.has("bookings:refund")) {
      throw new RefundError("agent may not issue refunds", "forbidden");
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new RefundError("amount must be a positive integer", "invalid_amount");
    }
    if (reason.trim().length < 10) {
      throw new RefundError("a reason of at least 10 characters is required", "missing_reason");
    }

    const booking = await this.store.load(bookingId);
    if (!booking) {
      throw new RefundError("booking not found", "not_found");
    }
    if (booking.status === "refunded") {
      throw new RefundError("booking already fully refunded", "already_refunded");
    }
    const remaining = booking.totalCents - booking.refundedCents;
    if (amountCents > remaining) {
      throw new RefundError(`only ${remaining} cents refundable`, "exceeds_balance");
    }

    const before = booking;
    booking.refundedCents += amountCents;
    if (booking.refundedCents === booking.totalCents) {
      booking.status = "refunded";
    }
    booking.notes.push(`refund ${amountCents} by ${agent.id}: ${reason}`);

    const record: AuditRecord = {
      bookingId: booking.id,
      agentId: agent.id,
      action: "booking.refund.manual",
      before: snapshot(before),
      after: snapshot(booking),
      at: this.now(),
    };
    await this.store.saveWithAudit(booking, record);
    return booking;
  }
}
