export interface PipelineRun {
  id: string;
  repo: string;
  branch: string;
  status: "passed" | "failed" | "cancelled";
  failedStep?: string;
  triggeredBy: string;
}

export interface ChatNotifier {
  notifyFailure(channel: string, message: string): Promise<void>;
}

export interface OwnershipLookup {
  channelFor(repo: string): Promise<string | undefined>;
}

export class RunCompletionHandler {
  constructor(
    private readonly notifier: ChatNotifier,
    private readonly owners: OwnershipLookup,
    private readonly protectedBranches: string[] = ["main", "release"],
  ) {}

  async onRunCompleted(run: PipelineRun): Promise<"notified" | "skipped"> {
    if (run.status !== "failed") return "skipped";
    if (!this.protectedBranches.includes(run.branch)) return "skipped";

    const channel = (await this.owners.channelFor(run.repo)) ?? "#ci-alerts";
    const step = run.failedStep ?? "unknown step";
    await this.notifier.notifyFailure(
      channel,
      `${run.repo}@${run.branch} failed at ${step} (run ${run.id}, by ${run.triggeredBy})`,
    );
    return "notified";
  }
}
