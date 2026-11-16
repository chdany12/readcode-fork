import { Logger } from "./logger";

export interface BuildJob {
  jobId: string;
  pipelineId: string;
  repo: string;
  commitSha: string;
  steps: { name: string; command: string }[];
}

export interface StepExecutor {
  run(command: string, opts: { timeoutMs: number }): Promise<{ exitCode: number; durationMs: number }>;
}

export type JobResult = { jobId: string; status: "passed" | "failed"; failedStep?: string };

export class BuildRunner {
  constructor(
    private readonly executor: StepExecutor,
    private readonly rootLogger: Logger,
    private readonly stepTimeoutMs = 15 * 60_000,
  ) {}

  async runAll(jobs: BuildJob[], concurrency: number): Promise<JobResult[]> {
    const results: JobResult[] = [];
    const queue = [...jobs];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const job = queue.shift()!;
        results.push(await this.runJob(job));
      }
    });
    await Promise.all(workers);
    return results;
  }

  async runJob(job: BuildJob): Promise<JobResult> {
    const log = this.rootLogger.child({
      jobId: job.jobId,
      pipelineId: job.pipelineId,
      repo: job.repo,
      commit: job.commitSha.slice(0, 12),
    });
    log.info("job started", { steps: job.steps.length });

    for (const step of job.steps) {
      const stepLog = log.child({ step: step.name });
      stepLog.debug("step starting", { command: step.command });
      try {
        const { exitCode, durationMs } = await this.executor.run(step.command, {
          timeoutMs: this.stepTimeoutMs,
        });
        if (exitCode !== 0) {
          stepLog.warn("step failed", { exitCode, durationMs });
          return { jobId: job.jobId, status: "failed", failedStep: step.name };
        }
        stepLog.info("step passed", { durationMs });
      } catch (err) {
        stepLog.error("step errored", {
          error: err instanceof Error ? err.message : String(err),
        });
        return { jobId: job.jobId, status: "failed", failedStep: step.name };
      }
    }

    log.info("job passed");
    return { jobId: job.jobId, status: "passed" };
  }
}
