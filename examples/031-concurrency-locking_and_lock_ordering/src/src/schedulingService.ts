import { LockTimeoutError, ResourceLockManager } from "./lockManager";

export interface Slot {
  providerId: string;
  roomId: string;
  startsAt: Date;
  minutes: number;
}

export interface Appointment extends Slot {
  id: string;
  patientId: string;
  status: "booked" | "cancelled";
}

export interface AppointmentRepo {
  findById(id: string): Promise<Appointment | undefined>;
  overlapping(field: "providerId" | "roomId", id: string, from: Date, to: Date): Promise<Appointment[]>;
  insert(a: Appointment): Promise<void>;
  update(a: Appointment): Promise<void>;
}

export type BookingResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; reason: "conflict" | "busy" | "not_found" };

const LOCK_WAIT_MS = 2_000;

export class SchedulingService {
  constructor(
    private readonly repo: AppointmentRepo,
    private readonly locks: ResourceLockManager,
    private readonly newId: () => string,
  ) {}

  private keysFor(...slots: Slot[]): string[] {
    return slots.flatMap((s) => [`provider:${s.providerId}`, `room:${s.roomId}`]);
  }

  private async isFree(slot: Slot, ignoreId?: string): Promise<boolean> {
    const end = new Date(slot.startsAt.getTime() + slot.minutes * 60_000);
    const [byProvider, byRoom] = await Promise.all([
      this.repo.overlapping("providerId", slot.providerId, slot.startsAt, end),
      this.repo.overlapping("roomId", slot.roomId, slot.startsAt, end),
    ]);
    return [...byProvider, ...byRoom].every((a) => a.status === "cancelled" || a.id === ignoreId);
  }

  async book(patientId: string, slot: Slot): Promise<BookingResult> {
    try {
      return await this.locks.withLocks(this.keysFor(slot), LOCK_WAIT_MS, async () => {
        if (!(await this.isFree(slot))) return { ok: false, reason: "conflict" } as const;
        const appointment: Appointment = { ...slot, id: this.newId(), patientId, status: "booked" };
        await this.repo.insert(appointment);
        return { ok: true, appointment } as const;
      });
    } catch (err) {
      if (err instanceof LockTimeoutError) return { ok: false, reason: "busy" };
      throw err;
    }
  }

  async reschedule(appointmentId: string, current: Slot, next: Slot): Promise<BookingResult> {
    try {
      return await this.locks.withLocks(this.keysFor(current, next), LOCK_WAIT_MS, async () => {
        const existing = await this.repo.findById(appointmentId);
        if (!existing || existing.status !== "booked") return { ok: false, reason: "not_found" } as const;
        if (existing.providerId !== current.providerId || existing.roomId !== current.roomId) {
          return { ok: false, reason: "conflict" } as const;
        }
        if (!(await this.isFree(next, appointmentId))) return { ok: false, reason: "conflict" } as const;
        const updated: Appointment = { ...existing, ...next };
        await this.repo.update(updated);
        return { ok: true, appointment: updated } as const;
      });
    } catch (err) {
      if (err instanceof LockTimeoutError) return { ok: false, reason: "busy" };
      throw err;
    }
  }
}
