import { CheckResult, DependencyCheck, runCheck } from "./checks";

export interface HealthResponse {
  status: number;
  body: { status: string; checks?: CheckResult[]; checkedAt?: string };
}

export interface HealthOptions {
  checkTimeoutMs: number;
  cacheMs: number;
}

export class HealthService {
  private cached: { results: CheckResult[]; at: number } | null = null;
  private inflight: Promise<CheckResult[]> | null = null;
  private shuttingDown = false;

  constructor(
    private readonly checks: DependencyCheck[],
    private readonly opts: HealthOptions,
    private readonly now: () => number = Date.now,
  ) {}

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  liveness(): HealthResponse {
    return { status: 200, body: { status: "alive" } };
  }

  async readiness(): Promise<HealthResponse> {
    if (this.shuttingDown) {
      return { status: 503, body: { status: "shutting_down" } };
    }

    const results = await this.currentResults();
    const criticalDown = results.some((r) => r.critical && r.status === "fail");
    const degraded = results.some((r) => !r.critical && r.status === "fail");

    return {
      status: criticalDown ? 503 : 200,
      body: {
        status: criticalDown ? "unavailable" : degraded ? "degraded" : "ok",
        checks: results,
        checkedAt: new Date(this.cached?.at ?? this.now()).toISOString(),
      },
    };
  }

  private async currentResults(): Promise<CheckResult[]> {
    if (this.cached && this.now() - this.cached.at < this.opts.cacheMs) {
      return this.cached.results;
    }
    if (!this.inflight) {
      this.inflight = Promise.all(this.checks.map((c) => runCheck(c, this.opts.checkTimeoutMs)))
        .then((results) => {
          this.cached = { results, at: this.now() };
          return results;
        })
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }
}
