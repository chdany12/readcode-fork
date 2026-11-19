import { EncodaTranscoderClient, TranscodeJob, TranscoderError } from "./encodaTranscoderClient";

export interface AssetRepo {
  pendingTranscodes(limit: number): Promise<Array<{ assetId: string; jobId: string }>>;
  markReady(assetId: string, renditions: TranscodeJob["renditions"]): Promise<void>;
  markFailed(assetId: string, reason: string): Promise<void>;
}

export class TranscodePoller {
  private running = false;

  constructor(private readonly transcoder: EncodaTranscoderClient, private readonly assets: AssetRepo) {}

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.assets.pendingTranscodes(50);
      for (const { assetId, jobId } of pending) {
        await this.checkOne(assetId, jobId);
      }
    } finally {
      this.running = false;
    }
  }

  private async checkOne(assetId: string, jobId: string): Promise<void> {
    let job: TranscodeJob;
    try {
      job = await this.transcoder.getJob(jobId);
    } catch (err) {
      if (err instanceof TranscoderError && !err.retryable) {
        await this.assets.markFailed(assetId, err.message);
      }
      return;
    }
    if (job.state === "complete") {
      await this.assets.markReady(assetId, job.renditions);
    } else if (job.state === "errored") {
      await this.assets.markFailed(assetId, job.errorMessage ?? "transcode failed");
    }
  }
}
