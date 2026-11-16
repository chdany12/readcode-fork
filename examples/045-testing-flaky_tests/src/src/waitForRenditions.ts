export type JobState = "queued" | "transcoding" | "ready" | "failed";

export interface TranscodeStatus {
  jobId: string;
  state: JobState;
  renditions: string[];
}

export interface TranscoderApi {
  getStatus(jobId: string): Promise<TranscodeStatus>;
}

export interface Sleeper {
  sleep(ms: number): Promise<void>;
}

export const realSleeper: Sleeper = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class TranscodeTimeoutError extends Error {
  constructor(public readonly jobId: string, public readonly attempts: number) {
    super(`transcode ${jobId} not finished after ${attempts} polls`);
  }
}

export async function waitForRenditions(
  api: TranscoderApi,
  jobId: string,
  opts: { intervalMs: number; maxPolls: number },
  sleeper: Sleeper = realSleeper,
): Promise<string[]> {
  for (let attempt = 1; attempt <= opts.maxPolls; attempt++) {
    const status = await api.getStatus(jobId);
    if (status.state === "ready") {
      return [...status.renditions].sort();
    }
    if (status.state === "failed") {
      throw new Error(`transcode ${jobId} failed`);
    }
    if (attempt < opts.maxPolls) {
      await sleeper.sleep(opts.intervalMs);
    }
  }
  throw new TranscodeTimeoutError(jobId, opts.maxPolls);
}
