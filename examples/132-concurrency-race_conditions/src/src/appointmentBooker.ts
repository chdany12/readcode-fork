import { KeyedMutex } from "./keyedMutex";

export interface Slot {
  id: string;
  providerId: string;
  startsAt: string;
  capacity: number;
  bookedPatientIds: string[];
}

export interface SlotRepository {
  find(slotId: string): Promise<Slot | null>;
  save(slot: Slot): Promise<void>;
}

export class BookingError extends Error {
  constructor(readonly code: "slot_not_found" | "slot_full" | "already_booked", message: string) {
    super(message);
  }
}

export class AppointmentBooker {
  private readonly locks = new KeyedMutex();

  constructor(private readonly slots: SlotRepository) {}

  async book(slotId: string, patientId: string): Promise<Slot> {
    return this.locks.runExclusive(slotId, async () => {
      const slot = await this.slots.find(slotId);
      if (!slot) {
        throw new BookingError("slot_not_found", `slot ${slotId} does not exist`);
      }
      if (slot.bookedPatientIds.includes(patientId)) {
        throw new BookingError("already_booked", `patient already booked into ${slotId}`);
      }
      if (slot.bookedPatientIds.length >= slot.capacity) {
        throw new BookingError("slot_full", `slot ${slotId} is full`);
      }
      const updated: Slot = { ...slot, bookedPatientIds: [...slot.bookedPatientIds, patientId] };
      await this.slots.save(updated);
      return updated;
    });
  }

  async cancel(slotId: string, patientId: string): Promise<Slot> {
    return this.locks.runExclusive(slotId, async () => {
      const slot = await this.slots.find(slotId);
      if (!slot) {
        throw new BookingError("slot_not_found", `slot ${slotId} does not exist`);
      }
      const updated: Slot = {
        ...slot,
        bookedPatientIds: slot.bookedPatientIds.filter((id) => id !== patientId),
      };
      await this.slots.save(updated);
      return updated;
    });
  }
}

export function singleInstanceBooker(slots: SlotRepository): AppointmentBooker {
  return new AppointmentBooker(slots);
}
