export type AppointmentStatus = "booked" | "checked_in" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  startsAt: string;
  durationMinutes: number;
  reason: string;
  notes: string | null;
  status: AppointmentStatus;
  version: number;
}

export class AppointmentStore {
  private rows = new Map<string, Appointment>();

  async get(id: string): Promise<Appointment | undefined> {
    return this.rows.get(id);
  }

  async listForProvider(providerId: string, day: string): Promise<Appointment[]> {
    return [...this.rows.values()]
      .filter((a) => a.providerId === providerId && a.startsAt.startsWith(day))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async save(appt: Appointment): Promise<void> {
    this.rows.set(appt.id, appt);
  }
}
