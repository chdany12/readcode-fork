import { JobScheduler, CiJob } from "./scheduler";

let seq = 0;
function makeJob(overrides: Partial<CiJob> = {}): CiJob {
  seq++;
  return {
    id: `job-${seq}`, pipelineId: "pipe-1", priority: 0, state: "queued",
    attempts: 0, maxAttempts: 2, ...overrides,
  };
}

describe("JobScheduler", () => {
  it("dispatches higher priority jobs first", () => {
    const s = new JobScheduler(1);
    const low = makeJob({ priority: 1 });
    const high = makeJob({ priority: 5 });
    s.submit(low);
    s.submit(high);
    expect(s.dispatch().map((j) => j.id)).toEqual([high.id]);
  });

  it("never runs more than maxConcurrent jobs", () => {
    const s = new JobScheduler(2);
    for (let i = 0; i < 5; i++) s.submit(makeJob());
    expect(s.dispatch()).toHaveLength(2);
    expect(s.dispatch()).toHaveLength(0);
  });

  it("requeues a failed job until maxAttempts is reached", () => {
    const s = new JobScheduler(1);
    const job = makeJob({ maxAttempts: 2 });
    s.submit(job);
    s.dispatch();
    s.complete(job.id, false);
    expect(job.state).toBe("queued");
    s.dispatch();
    s.complete(job.id, false);
    expect(job.state).toBe("failed");
    expect(job.attempts).toBe(2);
  });

  it("removes cancelled jobs from the queue", () => {
    const s = new JobScheduler(1);
    const running = makeJob();
    const waiting = makeJob();
    const other = makeJob({ pipelineId: "pipe-2" });
    [running, waiting, other].forEach((j) => s.submit(j));
    s.dispatch();

    expect(s.cancelPipeline("pipe-1")).toBe(2);
    expect(s.queue).not.toContain(waiting);
    expect(s.queue).toContain(other.id);
  });

  it("ignores completion of a job that is not running", () => {
    const s = new JobScheduler(1);
    const job = makeJob();
    s.submit(job);
    s.complete(job.id, true);
    expect(job.state).toBe("queued");
  });
});
