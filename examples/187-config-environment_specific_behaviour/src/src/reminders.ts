import { EnvProfile } from "./envProfile";

export interface Appointment {
  id: string;
  patientPhone: string;
  clinicName: string;
  startsAt: Date;
}

export interface SmsSender {
  send(to: string, body: string): Promise<void>;
}

export class ConsoleSms implements SmsSender {
  async send(to: string, body: string): Promise<void> {
    console.log(JSON.stringify({ channel: "sms", to, length: body.length }));
  }
}

export class ReminderService {
  constructor(
    private readonly profile: EnvProfile,
    private readonly sms: SmsSender,
    private readonly now: () => Date = () => new Date(),
  ) {}

  due(appointments: Appointment[]): Appointment[] {
    const horizon = this.now().getTime() + this.profile.reminderLeadHours * 3_600_000;
    return appointments.filter(
      (a) => a.startsAt.getTime() > this.now().getTime() && a.startsAt.getTime() <= horizon,
    );
  }

  async sendReminders(appointments: Appointment[]): Promise<number> {
    let sent = 0;
    for (const appt of this.due(appointments)) {
      const to = this.profile.redirectSmsTo ?? appt.patientPhone;
      const when = appt.startsAt.toISOString().slice(0, 16).replace("T", " ");
      try {
        await this.sms.send(to, `Reminder: appointment at ${appt.clinicName} on ${when} UTC. Reply C to confirm.`);
        sent++;
      } catch (err) {
        console.error(JSON.stringify({ msg: "reminder failed", appointmentId: appt.id, error: (err as Error).message }));
      }
    }
    return sent;
  }
}
