import { Worker } from "worker_threads";
import { createStatsBuffer, IngestStats } from "./ingestStats";

export interface MetricsSink {
  report(name: string, value: number, tags?: Record<string, string>): void;
}

export class IngestPool {
  private readonly workers: Worker[] = [];
  private readonly statsBuffer = createStatsBuffer();
  private readonly stats = new IngestStats(this.statsBuffer);
  private next = 0;
  private flushTimer?: NodeJS.Timeout;

  constructor(private readonly size: number, private readonly sink: MetricsSink) {}

  start(onFrame: (frame: unknown) => void): void {
    for (let i = 0; i < this.size; i++) {
      const w = new Worker(new URL("./ingestWorker.js", import.meta.url), {
        workerData: { statsBuffer: this.statsBuffer },
      });
      w.on("message", (msg) => {
        if (msg.type === "frame") onFrame(msg.frame);
      });
      this.workers.push(w);
    }
    this.flushTimer = setInterval(() => this.flush(), 10_000);
  }

  submit(raw: Buffer): void {
    const w = this.workers[this.next];
    this.next = (this.next + 1) % this.workers.length;
    w.postMessage(raw);
  }

  private flush(): void {
    const d = this.stats.drainCounters();
    const inflight = this.stats.snapshot().inflight;
    this.sink.report("telemetry.frames.accepted", Number(d.accepted));
    this.sink.report("telemetry.frames.rejected", Number(d.rejected));
    this.sink.report("telemetry.bytes", Number(d.bytes));
    this.sink.report("telemetry.inflight", Number(inflight));
  }

  async stop(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
