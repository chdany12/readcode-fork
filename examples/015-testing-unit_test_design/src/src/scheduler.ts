export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface CiJob {
  id: string;
  pipelineId: string;
  priority: number;
  state: JobState;
  attempts: number;
  maxAttempts: number;
}

export class JobScheduler {
  readonly queue: string[] = [];
  private readonly jobs = new Map<string, CiJob>();

  constructor(private readonly maxConcurrent: number) {}

  submit(job: CiJob): void {
    if (this.jobs.has(job.id)) throw new Error(`duplicate job ${job.id}`);
    this.jobs.set(job.id, job);
    this.enqueue(job.id);
  }

  cancelPipeline(pipelineId: string): number {
    let cancelled = 0;
    for (const job of this.jobs.values()) {
      if (job.pipelineId === pipelineId && (job.state === "queued" || job.state === "running")) {
        job.state = "cancelled";
        cancelled++;
      }
    }
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.jobs.get(this.queue[i])!.state === "cancelled") this.queue.splice(i, 1);
    }
    return cancelled;
  }

  dispatch(): CiJob[] {
    const running = [...this.jobs.values()].filter((j) => j.state === "running").length;
    const slots = Math.max(0, this.maxConcurrent - running);
    const started: CiJob[] = [];
    while (started.length < slots && this.queue.length > 0) {
      const job = this.jobs.get(this.queue.shift()!)!;
      job.state = "running";
      job.attempts++;
      started.push(job);
    }
    return started;
  }

  complete(jobId: string, ok: boolean): void {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== "running") return;
    if (ok) {
      job.state = "succeeded";
    } else if (job.attempts < job.maxAttempts) {
      job.state = "queued";
      this.enqueue(job.id);
    } else {
      job.state = "failed";
    }
  }

  private enqueue(id: string): void {
    const prio = this.jobs.get(id)!.priority;
    const idx = this.queue.findIndex((q) => this.jobs.get(q)!.priority < prio);
    if (idx === -1) this.queue.push(id);
    else this.queue.splice(idx, 0, id);
  }
}
