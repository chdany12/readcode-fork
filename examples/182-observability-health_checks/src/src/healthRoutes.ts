import { Router, Request, Response } from "express";
import { Probe } from "./dependencies";

interface ProbeOutcome {
  name: string;
  ok: boolean;
  error?: string;
}

async function runAll(probes: Probe[]): Promise<ProbeOutcome[]> {
  const settled = await Promise.allSettled(probes.map((p) => p.check()));
  return settled.map((s, i) => ({
    name: probes[i].name,
    ok: s.status === "fulfilled",
    error: s.status === "rejected" ? String((s.reason as Error)?.message ?? s.reason) : undefined,
  }));
}

export interface HealthState {
  startedAt: number;
  migrationsApplied: boolean;
  draining: boolean;
}

export function healthRouter(state: HealthState, probes: Probe[], log: (o: object) => void): Router {
  const router = Router();

  router.get("/health/live", async (_req: Request, res: Response) => {
    const outcomes = await runAll(probes.filter((p) => p.name === "postgres"));
    const ok = outcomes.every((o) => o.ok);
    if (!ok) {
      log({ msg: "liveness failing", outcomes });
    }
    res.status(ok ? 200 : 503).json({ status: ok ? "alive" : "dead", uptimeMs: Date.now() - state.startedAt });
  });

  router.get("/health/ready", async (_req: Request, res: Response) => {
    if (state.draining || !state.migrationsApplied) {
      res.status(503).json({ status: state.draining ? "draining" : "starting" });
      return;
    }

    const outcomes = await runAll(probes);
    const ok = outcomes.every((o) => o.ok);
    if (!ok) {
      log({ msg: "readiness failing", outcomes });
    }
    res.set("Cache-Control", "no-store");
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready", checks: outcomes });
  });

  return router;
}
