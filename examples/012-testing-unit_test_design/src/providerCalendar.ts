export interface Slot {
  providerId: string;
  start: Date;
  durationMin: number;
  patientId: string | null;
}

export class SlotUnavailableError extends Error {
  constructor(readonly providerId: string, readonly start: Date) {
    super(`slot ${providerId}@${start.toISOString()} is not available`);
    this.name = "SlotUnavailableError";
  }
}

export class ProviderCalendar {
  private readonly slots = new Map<string, Slot>();

  constructor(readonly providerId: string) {}

  private key(start: Date): string {
    return start.toISOString();
  }

  openSlot(start: Date, durationMin = 30): void {
    const k = this.key(start);
    if (!this.slots.has(k)) {
      this.slots.set(k, { providerId: this.providerId, start, durationMin, patientId: null });
    }
  }

  book(start: Date, patientId: string): Slot {
    const slot = this.slots.get(this.key(start));
    if (!slot || slot.patientId !== null) {
      throw new SlotUnavailableError(this.providerId, start);
    }
    slot.patientId = patientId;
    return { ...slot };
  }

  cancel(start: Date, patientId: string): boolean {
    const slot = this.slots.get(this.key(start));
    if (!slot || slot.patientId !== patientId) return false;
    slot.patientId = null;
    return true;
  }

  available(): Date[] {
    return [...this.slots.values()]
      .filter((s) => s.patientId === null)
      .map((s) => s.start)
      .sort((a, b) => a.getTime() - b.getTime());
  }
}
