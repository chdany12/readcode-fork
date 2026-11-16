import { randomUUID } from "crypto";
import { AppointmentRepo, SlotConflictError } from "./appointmentRepo";

export interface BookingRequest {
  clinicId: string;
  providerId: string;
  patientId: string;
  slotStart: string;
  reason: string;
}

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: "slot_taken" | "invalid_slot" };

export class BookingService {
  constructor(private readonly repo: AppointmentRepo) {}

  async book(req: BookingRequest, actor: string): Promise<BookingResult> {
    const start = new Date(req.slotStart);
    if (Number.isNaN(start.getTime()) || start.getUTCMinutes() % 15 !== 0) {
      return { ok: false, reason: "invalid_slot" };
    }
    const slotStart = start.toISOString();
    const appointmentId = randomUUID();
    try {
      await this.repo.book({
        appointmentId,
        clinicId: req.clinicId,
        providerId: req.providerId,
        patientId: req.patientId,
        slotStart,
        durationMin: 15,
        reason: req.reason,
      });
    } catch (err) {
      if (err instanceof SlotConflictError) return { ok: false, reason: "slot_taken" };
      throw err;
    }
    await this.repo.recordAudit(
      { appointmentId, slotStart, durationMin: 15, ...req },
      actor,
    );
    return { ok: true, appointmentId };
  }
}
