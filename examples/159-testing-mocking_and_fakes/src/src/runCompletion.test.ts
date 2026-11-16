import { RunCompletionHandler, PipelineRun, ChatNotifier, OwnershipLookup } from "./runCompletion";

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    id: "run_42",
    repo: "payments-api",
    branch: "main",
    status: "failed",
    failedStep: "integration-tests",
    triggeredBy: "merge-bot",
    ...overrides,
  };
}

describe("RunCompletionHandler", () => {
  let notifier: jest.Mocked<ChatNotifier>;
  let owners: jest.Mocked<OwnershipLookup>;
  let handler: RunCompletionHandler;

  beforeEach(() => {
    notifier = { notifyFailure: jest.fn().mockResolvedValue(undefined) };
    owners = { channelFor: jest.fn().mockResolvedValue("#payments-eng") };
    handler = new RunCompletionHandler(notifier, owners);
  });

  it("posts to the owning team's channel on a failed main build", async () => {
    const result = await handler.onRunCompleted(makeRun());
    expect(result).toBe("notified");
    expect(owners.channelFor).toHaveBeenCalledWith("payments-api");
    expect(notifier.notifyFailure).toHaveBeenCalledWith(
      "#payments-eng",
      "payments-api@main failed at integration-tests (run run_42, by merge-bot)",
    );
  });

  it("falls back to #ci-alerts when the repo has no owner", async () => {
    owners.channelFor.mockResolvedValueOnce(undefined);
    await handler.onRunCompleted(makeRun({ repo: "legacy-batch" }));
    expect(notifier.notifyFailure).toHaveBeenCalledWith("#ci-alerts", expect.stringContaining("legacy-batch@main"));
  });

  it("stays quiet for feature branches", async () => {
    const result = await handler.onRunCompleted(makeRun({ branch: "feature/retry-ui" }));
    expect(result).toBe("skipped");
    expect(notifier.notifyFailure).not.toHaveBeenCalled();
  });

  it("stays quiet for passing runs", async () => {
    const result = await handler.onRunCompleted(makeRun({ status: "passed" }));
    expect(result).toBe("skipped");
    expect(owners.channelFor).not.toHaveBeenCalled();
  });

  it("notifies for release branch failures without a step name", async () => {
    await handler.onRunCompleted(makeRun({ branch: "release", failedStep: undefined }));
    expect(notifier.notifyFailure).toHaveBeenCalled;
    expect(notifier.notifyFailure.mock.calls[0]?.[1] ?? "").toContain("unknown step");
  });

  it("propagates notifier outages to the caller", async () => {
    notifier.notifyFailure.mockRejectedValueOnce(new Error("chat API 503"));
    await expect(handler.onRunCompleted(makeRun())).rejects.toThrow("chat API 503");
  });
});
