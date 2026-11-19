import { randomUUID } from "crypto";

export type RunState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface PipelineRun {
  id: string;
  pipelineId: string;
  commitSha: string;
  ref: string;
  state: RunState;
  createdAt: string;
  finishedAt: string | null;
}

export interface RunQueue {
  enqueue(runId: string): Promise<void>;
}

export class RunService {
  private runs = new Map<string, PipelineRun>();

  constructor(private readonly queue: RunQueue) {}

  async trigger(pipelineId: string, commitSha: string, ref: string): Promise<PipelineRun> {
    const run: PipelineRun = {
      id: randomUUID(),
      pipelineId,
      commitSha,
      ref,
      state: "queued",
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
    this.runs.set(run.id, run);
    await this.queue.enqueue(run.id);
    return run;
  }

  find(pipelineId: string, runId: string): PipelineRun | undefined {
    const run = this.runs.get(runId);
    return run && run.pipelineId === pipelineId ? run : undefined;
  }

  list(pipelineId: string, state?: RunState): PipelineRun[] {
    return [...this.runs.values()]
      .filter((r) => r.pipelineId === pipelineId && (!state || r.state === state))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  cancel(run: PipelineRun): PipelineRun {
    if (run.state === "queued" || run.state === "running") {
      run.state = "cancelled";
      run.finishedAt = new Date().toISOString();
    }
    return run;
  }
}
