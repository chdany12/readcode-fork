import { Pool } from "pg";
import { ReminderRepo, ReminderJob } from "./reminderRepo";

export interface Notifier {
  send(channel: "sms" | "email", to: string, text: string): Promise<void>;
}

const IDLE_POLL_MS = 1_000;
const DRAIN_TIMEOUT_MS = 25_000;

export class ReminderWorker {
  private stopping = false;
  private inFlight = new Set<Promise<void>>();
  private loopDone: Promise<void> | null = null;

  constructor(
    private pool: Pool,
    private repo: ReminderRepo,
    private notifier: Notifier,
    private workerId: string,
    private concurrency = 4,
  ) {}

  start(): void {
    this.loopDone = this.loop();
  }

  private async loop(): Promise<void> {
    while (!this.stopping) {
      if (this.inFlight.size >= this.concurrency) {
        await Promise.race(this.inFlight);
        continue;
      }
      const job = await this.repo.claimNext(this.workerId);
      if (!job) {
        await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
        continue;
      }
      void this.track(job);
    }
  }

  private async track(job: ReminderJob): Promise<void> {
    const appt = await this.repo.loadAppointment(job.appointmentId);
    const p = this.process(job, appt).finally(() => this.inFlight.delete(p));
    this.inFlight.add(p);
    await p;
  }

  private async process(job: ReminderJob, appt: any): Promise<void> {
    try {
      if (!appt) {
        await this.repo.complete(job.id, "skipped");
        return;
      }
      const to = job.channel === "sms" ? appt.phone : appt.email;
      const when = new Date(appt.starts_at).toLocaleString("en-US");
      await this.notifier.send(job.channel, to, `Reminder: your appointment at ${appt.clinic} is on ${when}.`);
      await this.repo.complete(job.id, "sent");
    } catch (err) {
      console.error("reminder failed; lease will expire and job will be retried", job.id, err);
    }
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    await this.loopDone;
    const drained = Promise.allSettled([...this.inFlight]).then(() => true);
    const timedOut = new Promise<boolean>((r) => setTimeout(() => r(false), DRAIN_TIMEOUT_MS).unref());
    const ok = await Promise.race([drained, timedOut]);
    if (!ok) console.warn(`shutdown: ${this.inFlight.size} reminders still running, leases will expire`);
    await this.pool.end();
  }
}
