import { Channel, ConsumeMessage } from "amqplib";
import { Pool } from "pg";
import { SmsClient } from "./smsClient";

interface ReminderMessage {
  messageId: string;
  appointmentId: string;
  patientPhone: string;
  startsAt: string;
}

export class ReminderConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly sms: SmsClient,
    private readonly queue = "appointment.reminders",
  ) {}

  async start(): Promise<void> {
    await this.channel.prefetch(10);
    await this.channel.consume(this.queue, (msg) => {
      if (!msg) return;
      this.handle(msg).catch((err) => {
        console.error("reminder handler crashed", { err: String(err) });
        this.channel.nack(msg, false, true);
      });
    }, { noAck: false });
  }

  private async handle(msg: ConsumeMessage): Promise<void> {
    let body: ReminderMessage;
    try {
      body = JSON.parse(msg.content.toString("utf8"));
    } catch {
      this.channel.nack(msg, false, false);
      return;
    }

    const appt = await this.pool.query(
      "SELECT status, reminder_sent_at FROM appointments WHERE id = $1",
      [body.appointmentId],
    );
    const row = appt.rows[0];
    if (!row || row.status === "cancelled" || row.reminder_sent_at) {
      this.channel.ack(msg);
      return;
    }

    const text = `Reminder: your appointment is at ${new Date(body.startsAt).toUTCString()}. Reply C to cancel.`;
    await this.sms.send({ to: body.patientPhone, text, idempotencyKey: `reminder:${body.appointmentId}` });

    await this.pool.query(
      "UPDATE appointments SET reminder_sent_at = now() WHERE id = $1 AND reminder_sent_at IS NULL",
      [body.appointmentId],
    );
    this.channel.ack(msg);
  }
}
