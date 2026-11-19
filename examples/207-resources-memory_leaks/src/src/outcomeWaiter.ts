import { EventEmitter } from "node:events";

export type PaymentOutcome = { paymentId: string; status: "succeeded" | "failed"; failureCode?: string };

interface Waiter {
  resolve: (o: PaymentOutcome) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export class PaymentOutcomeWaiter {
  private readonly waiters = new Map<string, Waiter[]>();
  private readonly recent = new Map<string, PaymentOutcome>();

  constructor(private readonly events: EventEmitter, private readonly recentLimit = 5_000) {
    events.on("payment.outcome", (o: PaymentOutcome) => this.deliver(o));
  }

  wait(paymentId: string, timeoutMs = 15_000): Promise<PaymentOutcome> {
    const known = this.recent.get(paymentId);
    if (known) return Promise.resolve(known);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timed out waiting for payment ${paymentId}`));
      }, timeoutMs);
      const list = this.waiters.get(paymentId) ?? [];
      list.push({ resolve, reject, timer });
      this.waiters.set(paymentId, list);
    });
  }

  private deliver(outcome: PaymentOutcome): void {
    this.remember(outcome);
    const list = this.waiters.get(outcome.paymentId);
    if (!list) return;
    this.waiters.delete(outcome.paymentId);
    for (const w of list) {
      clearTimeout(w.timer);
      w.resolve(outcome);
    }
  }

  private remember(outcome: PaymentOutcome): void {
    this.recent.delete(outcome.paymentId);
    this.recent.set(outcome.paymentId, outcome);
    if (this.recent.size > this.recentLimit) {
      const oldest = this.recent.keys().next().value as string;
      this.recent.delete(oldest);
    }
  }

  pendingCount(): number {
    return this.waiters.size;
  }
}
