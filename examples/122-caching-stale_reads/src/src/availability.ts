import { clinicLocalDate } from "./time";

export interface Slot {
  slotId: string;
  providerId: string;
  startsAt: Date;
  durationMin: number;
  booked: boolean;
}

export interface Clinic {
  clinicId: string;
  timeZone: string;
}

export interface SlotRepo {
  listForDay(clinicId: string, localDate: string): Promise<Slot[]>;
  markBooked(slotId: string, patientId: string): Promise<Slot | null>;
}

export interface KV {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export class SlotTakenError extends Error {
  constructor(slotId: string) {
    super(`slot ${slotId} is no longer available`);
    this.name = "SlotTakenError";
  }
}

const AVAILABILITY_TTL_SECONDS = 15 * 60;

export class AvailabilityService {
  constructor(private readonly repo: SlotRepo, private readonly kv: KV) {}

  private key(clinicId: string, localDate: string): string {
    return `avail:${clinicId}:${localDate}`;
  }

  async openSlots(clinic: Clinic, localDate: string): Promise<Slot[]> {
    const k = this.key(clinic.clinicId, localDate);
    const cached = await this.kv.get(k);
    if (cached) {
      return (JSON.parse(cached) as Slot[]).map((s) => ({ ...s, startsAt: new Date(s.startsAt) }));
    }
    const slots = (await this.repo.listForDay(clinic.clinicId, localDate)).filter((s) => !s.booked);
    await this.kv.setEx(k, AVAILABILITY_TTL_SECONDS, JSON.stringify(slots));
    return slots;
  }

  async book(clinic: Clinic, slotId: string, patientId: string): Promise<Slot> {
    const slot = await this.repo.markBooked(slotId, patientId);
    if (!slot) {
      throw new SlotTakenError(slotId);
    }
    const day = slot.startsAt.toISOString().slice(0, 10);
    await this.kv.del(this.key(clinic.clinicId, day));
    return slot;
  }

  async dayFor(clinic: Clinic, instant: Date): Promise<Slot[]> {
    return this.openSlots(clinic, clinicLocalDate(instant, clinic.timeZone));
  }
}
