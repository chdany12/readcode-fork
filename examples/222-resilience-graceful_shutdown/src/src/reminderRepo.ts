import { Pool } from "pg";

export interface ReminderJob {
  id: string;
  appointmentId: string;
  channel: "sms" | "email";
}

export class ReminderRepo {
  constructor(private pool: Pool) {}

  async claimNext(workerId: string): Promise<ReminderJob | null> {
    const { rows } = await this.pool.query(
      `UPDATE reminder_jobs SET locked_by = $1, locked_until = now() + interval '2 minutes'
         WHERE id = (
           SELECT id FROM reminder_jobs
            WHERE status = 'pending' AND send_at <= now()
              AND (locked_until IS NULL OR locked_until < now())
            ORDER BY send_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1)
       RETURNING id, appointment_id AS "appointmentId", channel`,
      [workerId],
    );
    return rows[0] ?? null;
  }

  async loadAppointment(id: string) {
    const { rows } = await this.pool.query(
      `SELECT a.starts_at, p.phone, p.email, c.name AS clinic
         FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN clinics c ON c.id = a.clinic_id
        WHERE a.id = $1 AND a.status = 'booked'`,
      [id],
    );
    return rows[0] ?? null;
  }

  async complete(jobId: string, status: "sent" | "skipped"): Promise<void> {
    await this.pool.query(
      `UPDATE reminder_jobs SET status = $2, locked_by = NULL, locked_until = NULL WHERE id = $1`,
      [jobId, status],
    );
  }
}
