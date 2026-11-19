import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { uploadLog } from "./artifacts";

const execFileAsync = promisify(execFile);

export interface Step {
  name: string;
  command: string;
  args: string[];
  timeoutMs: number;
}

export interface StepResult {
  name: string;
  status: "passed" | "failed" | "cancelled" | "skipped";
  durationMs: number;
}

export class JobRunner {
  private readonly running = new Map<string, AbortController>();

  cancel(jobId: string): boolean {
    const ctrl = this.running.get(jobId);
    if (!ctrl) return false;
    ctrl.abort(new Error(`job ${jobId} cancelled`));
    return true;
  }

  async run(jobId: string, workdir: string, steps: Step[]): Promise<StepResult[]> {
    const ctrl = new AbortController();
    this.running.set(jobId, ctrl);
    const results: StepResult[] = [];
    try {
      for (const step of steps) {
        if (ctrl.signal.aborted) {
          results.push({ name: step.name, status: "skipped", durationMs: 0 });
          continue;
        }
        results.push(await this.runStep(jobId, workdir, step, ctrl.signal));
        if (results[results.length - 1].status === "failed") ctrl.abort(new Error("previous step failed"));
      }
      return results;
    } finally {
      this.running.delete(jobId);
    }
  }

  private async runStep(jobId: string, workdir: string, step: Step, signal: AbortSignal): Promise<StepResult> {
    const started = Date.now();
    const stepSignal = AbortSignal.any([signal, AbortSignal.timeout(step.timeoutMs)]);
    let output = "";
    let status: StepResult["status"] = "passed";
    try {
      const { stdout, stderr } = await execFileAsync(step.command, step.args, {
        cwd: workdir,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, CI: "true", JOB_ID: jobId },
      });
      output = stdout + stderr;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; name?: string };
      output = (e.stdout ?? "") + (e.stderr ?? "");
      status = stepSignal.aborted ? "cancelled" : "failed";
    }
    await uploadLog(jobId, step.name, output, AbortSignal.timeout(10_000));
    return { name: step.name, status, durationMs: Date.now() - started };
  }
}
