import { Pool } from "pg";
import os from "os";
import { ReminderRepo } from "./reminderRepo";
import { ReminderWorker, Notifier } from "./reminderWorker";

export function run(notifier: Notifier) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  const worker = new ReminderWorker(pool, new ReminderRepo(pool), notifier, `${os.hostname()}:${process.pid}`);
  worker.start();

  process.once("SIGTERM", async () => {
    await worker.shutdown();
    process.exit(0);
  });
}
