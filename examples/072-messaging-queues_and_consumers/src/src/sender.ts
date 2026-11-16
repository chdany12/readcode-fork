import type { NotificationJob } from "./consumer";

export class PermanentDeliveryError extends Error {}

export interface NotificationSender {
  send(job: NotificationJob, opts: { idempotencyKey: string }): Promise<void>;
}
