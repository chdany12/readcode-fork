import { Worker } from "worker_threads";
import { EventEmitter } from "events";

export interface InvoiceJob {
  invoiceId: string;
  lines: { sku: string; qty: number; unitCents: number; taxRate: number }[];
  currency: string;
}

export interface InvoiceTotals {
  invoiceId: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

interface Task {
  job: InvoiceJob;
  resolve: (t: InvoiceTotals) => void;
  reject: (e: Error) => void;
}

export class InvoiceWorkerPool extends EventEmitter {
  private readonly idle: Worker[] = [];
  private readonly busy = new Map<Worker, Task>();
  private readonly queue: Task[] = [];
  private closed = false;

  constructor(private readonly script: string, size: number, private readonly maxQueue = 1000) {
    super();
    for (let i = 0; i < size; i++) this.idle.push(this.spawn());
  }

  compute(job: InvoiceJob): Promise<InvoiceTotals> {
    if (this.closed) return Promise.reject(new Error("pool closed"));
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new Error("invoice pool saturated"));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.drain();
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const t of this.queue.splice(0)) t.reject(new Error("pool closed"));
    await Promise.all([...this.idle, ...this.busy.keys()].map((w) => w.terminate()));
  }

  private spawn(): Worker {
    const worker = new Worker(this.script);
    worker.on("message", (totals: InvoiceTotals) => {
      const task = this.busy.get(worker);
      this.busy.delete(worker);
      this.idle.push(worker);
      task?.resolve(totals);
      this.drain();
    });
    worker.on("error", (err) => {
      this.busy.delete(worker);
      this.emit("workerError", err);
      if (!this.closed) this.idle.push(this.spawn());
      this.drain();
    });
    return worker;
  }

  private drain() {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const task = this.queue.shift()!;
      this.busy.set(worker, task);
      worker.postMessage(task.job);
    }
  }
}
