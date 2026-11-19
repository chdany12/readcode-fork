import { Router } from "express";
import { RunService, RunState } from "./runService";

const STATES: RunState[] = ["queued", "running", "succeeded", "failed", "cancelled"];
const SHA = /^[0-9a-f]{40}$/;

export function runRoutes(runs: RunService): Router {
  const r = Router();

  r.post("/pipelines/:pipelineId/runs", async (req, res, next) => {
    try {
      const { commitSha, ref } = req.body ?? {};
      if (typeof commitSha !== "string" || !SHA.test(commitSha)) {
        return res.status(422).json({ error: "commitSha must be a 40-char hex sha" });
      }
      if (typeof ref !== "string" || ref.length === 0) {
        return res.status(422).json({ error: "ref is required" });
      }
      const run = await runs.trigger(req.params.pipelineId, commitSha, ref);
      res.status(202).location(`/runs/${run.id}`).json(run);
    } catch (err) {
      next(err);
    }
  });

  r.get("/pipelines/:pipelineId/runs", (req, res) => {
    const state = req.query.state as string | undefined;
    if (state !== undefined && !STATES.includes(state as RunState)) {
      return res.status(400).json({ error: `state must be one of ${STATES.join(", ")}` });
    }
    res.json({ items: runs.list(req.params.pipelineId, state as RunState | undefined) });
  });

  r.get("/pipelines/:pipelineId/runs/:runId", (req, res) => {
    const run = runs.find(req.params.pipelineId, req.params.runId);
    if (!run) return res.status(404).json({ error: "run not found" });
    const terminal = run.state !== "queued" && run.state !== "running";
    if (!terminal) res.set("Retry-After", "5");
    res.json(run);
  });

  r.post("/pipelines/:pipelineId/runs/:runId/cancel", (req, res) => {
    const run = runs.find(req.params.pipelineId, req.params.runId);
    if (!run) return res.status(404).json({ error: "run not found" });
    if (run.state === "succeeded" || run.state === "failed") {
      return res.status(409).json({ error: `run already ${run.state}` });
    }
    res.json(runs.cancel(run));
  });

  return r;
}
