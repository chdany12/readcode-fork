import { Pool } from "pg";

export interface PipelineRun {
  id: number;
  repoId: number;
  branch: string;
  commitSha: string;
  status: "queued" | "running" | "passed" | "failed";
  startedAt: Date;
}

export interface JobRow {
  id: number;
  runId: number;
  name: string;
  status: string;
  durationMs: number | null;
}

export class RunStore {
  constructor(private readonly pool: Pool) {}

  async recentRuns(repoId: number, limit: number, beforeId?: number): Promise<PipelineRun[]> {
    const params: unknown[] = [repoId, Math.min(limit, 100)];
    let cursor = "";
    if (beforeId !== undefined) {
      params.push(beforeId);
      cursor = "AND id < $3";
    }
    const { rows } = await this.pool.query(
      `SELECT id, repo_id AS "repoId", branch, commit_sha AS "commitSha", status,
              started_at AS "startedAt"
         FROM pipeline_runs
        WHERE repo_id = $1 ${cursor}
        ORDER BY id DESC
        LIMIT $2`,
      params,
    );
    return rows;
  }

  async jobsForRuns(runIds: number[]): Promise<JobRow[]> {
    if (runIds.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT id, run_id AS "runId", name, status, duration_ms AS "durationMs"
         FROM pipeline_jobs
        WHERE run_id = ANY($1::bigint[])
        ORDER BY run_id, id`,
      [runIds],
    );
    return rows;
  }

  async authorsForCommits(repoId: number, shas: string[]): Promise<Map<string, string>> {
    if (shas.length === 0) return new Map();
    const { rows } = await this.pool.query(
      `SELECT sha, author_login AS "login" FROM commits WHERE repo_id = $1 AND sha = ANY($2)`,
      [repoId, shas],
    );
    return new Map(rows.map((r: { sha: string; login: string }) => [r.sha, r.login]));
  }
}
