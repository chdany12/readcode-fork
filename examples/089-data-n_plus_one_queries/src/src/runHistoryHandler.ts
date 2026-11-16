import { RunStore, JobRow, PipelineRun } from "./runStore";

export interface RunSummary {
  id: number;
  branch: string;
  commitSha: string;
  author: string | null;
  status: PipelineRun["status"];
  jobs: { name: string; status: string; durationMs: number | null }[];
  slowestJob: string | null;
}

export interface RunPage {
  runs: RunSummary[];
  nextCursor: number | null;
}

export class RunHistoryHandler {
  constructor(private readonly store: RunStore) {}

  async list(repoId: number, limit: number, before?: number): Promise<RunPage> {
    const runs = await this.store.recentRuns(repoId, limit, before);
    const shas = [...new Set(runs.map((r) => r.commitSha))];

    const [authors, jobsPerRun] = await Promise.all([
      this.store.authorsForCommits(repoId, shas),
      Promise.all(runs.map((r) => this.store.jobsForRuns([r.id]))),
    ]);

    const summaries = runs.map((run, i) => this.summarize(run, jobsPerRun[i], authors));
    const last = runs[runs.length - 1];
    return {
      runs: summaries,
      nextCursor: runs.length === Math.min(limit, 100) && last ? last.id : null,
    };
  }

  private summarize(run: PipelineRun, jobs: JobRow[], authors: Map<string, string>): RunSummary {
    let slowest: JobRow | null = null;
    for (const job of jobs) {
      if (job.durationMs === null) continue;
      if (!slowest || (slowest.durationMs ?? 0) < job.durationMs) slowest = job;
    }
    return {
      id: run.id,
      branch: run.branch,
      commitSha: run.commitSha,
      author: authors.get(run.commitSha) ?? null,
      status: run.status,
      jobs: jobs.map((j) => ({ name: j.name, status: j.status, durationMs: j.durationMs })),
      slowestJob: slowest ? slowest.name : null,
    };
  }
}
