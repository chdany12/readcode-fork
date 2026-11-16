import { PoolClient } from "pg";
import { withConnection, withTransaction } from "./db";

export interface ClaimedJob {
  id: string;
  pipelineId: string;
  image: string;
  steps: string[];
}

async function loadPipelineSecrets(pipelineId: string): Promise<Record<string, string>> {
  return withConnection(async (c) => {
    const { rows } = await c.query(
      "SELECT name, ciphertext FROM pipeline_secrets WHERE pipeline_id = $1",
      [pipelineId],
    );
    return Object.fromEntries(rows.map((r) => [r.name, r.ciphertext]));
  });
}

async function claimNext(client: PoolClient, runnerId: string): Promise<ClaimedJob | null> {
  const { rows } = await client.query(
    `SELECT id, pipeline_id, image, steps
       FROM ci_jobs
      WHERE state = 'queued'
      ORDER BY enqueued_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED`,
  );
  if (rows.length === 0) return null;
  await client.query(
    "UPDATE ci_jobs SET state = 'running', runner_id = $2, started_at = now() WHERE id = $1",
    [rows[0].id, runnerId],
  );
  return {
    id: rows[0].id,
    pipelineId: rows[0].pipeline_id,
    image: rows[0].image,
    steps: rows[0].steps,
  };
}

export async function leaseJob(
  runnerId: string,
): Promise<{ job: ClaimedJob; secrets: Record<string, string> } | null> {
  return withTransaction(async (client) => {
    const job = await claimNext(client, runnerId);
    if (!job) return null;
    const secrets = await loadPipelineSecrets(job.pipelineId);
    await client.query(
      "INSERT INTO job_events (job_id, kind, runner_id) VALUES ($1, 'leased', $2)",
      [job.id, runnerId],
    );
    return { job, secrets };
  });
}

export async function completeJob(jobId: string, exitCode: number): Promise<void> {
  await withConnection(async (c) => {
    await c.query(
      "UPDATE ci_jobs SET state = $2, finished_at = now() WHERE id = $1 AND state = 'running'",
      [jobId, exitCode === 0 ? "succeeded" : "failed"],
    );
  });
}
