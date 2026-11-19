import type { Redis } from "ioredis";
import { TranscodeJob, TranscodeService } from "./transcode";
import { Logger } from "./logger";

export interface QueueMessage<T> {
  id: string;
  body: T;
  attempt: number;
  ack(): Promise<void>;
  nack(delayMs: number): Promise<void>;
}

const DEDUP_TTL_SECONDS = 6 * 60 * 60;
const MAX_ATTEMPTS = 8;

export class TranscodeConsumer {
  constructor(
    private readonly redis: Redis,
    private readonly transcoder: TranscodeService,
    private readonly log: Logger
  ) {}

  private dedupKey(job: TranscodeJob): string {
    return `transcode:seen:${job.assetId}:${job.renditionProfile}`;
  }

  async handle(msg: QueueMessage<TranscodeJob>): Promise<void> {
    const job = msg.body;
    const key = this.dedupKey(job);

    const claimed = await this.redis.set(key, msg.id, "EX", DEDUP_TTL_SECONDS, "NX");
    if (claimed === null) {
      this.log.info({ assetId: job.assetId, profile: job.renditionProfile }, "duplicate transcode job skipped");
      await msg.ack();
      return;
    }

    try {
      const output = await this.transcoder.run(job);
      await this.transcoder.publishRendition(job.assetId, job.renditionProfile, output);
      await msg.ack();
    } catch (err) {
      this.log.error({ err, assetId: job.assetId, attempt: msg.attempt }, "transcode failed");
      if (msg.attempt >= MAX_ATTEMPTS) {
        await this.transcoder.markFailed(job.assetId, job.renditionProfile);
        await msg.ack();
        return;
      }
      await msg.nack(Math.min(60_000, 1000 * 2 ** msg.attempt));
    }
  }
}
