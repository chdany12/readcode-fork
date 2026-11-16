import { SqsLikeQueue, ReceivedMessage } from "./queueTypes";
import { Transcoder, RenditionRequest } from "./transcoder";

const VISIBILITY_SECONDS = 120;
const HEARTBEAT_MS = 45_000;
const MAX_RECEIVES = 4;

export class TranscodeWorker {
  private stopping = false;
  private inFlight = 0;

  constructor(
    private readonly queue: SqsLikeQueue,
    private readonly transcoder: Transcoder,
    private readonly concurrency: number,
  ) {}

  async runForever(): Promise<void> {
    while (!this.stopping) {
      const free = this.concurrency - this.inFlight;
      if (free <= 0) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      const messages = await this.queue.receive({
        maxMessages: Math.min(free, 10),
        visibilityTimeoutSeconds: VISIBILITY_SECONDS,
        waitTimeSeconds: 10,
      });
      for (const m of messages) {
        this.inFlight++;
        void this.process(m).finally(() => {
          this.inFlight--;
        });
      }
    }
  }

  requestStop(): void {
    this.stopping = true;
  }

  private async process(m: ReceivedMessage): Promise<void> {
    let req: RenditionRequest;
    try {
      req = JSON.parse(m.body) as RenditionRequest;
    } catch {
      await this.queue.moveToDeadLetter(m.receiptHandle, "unparseable body");
      return;
    }

    const heartbeat = setInterval(() => {
      this.queue
        .changeVisibility(m.receiptHandle, VISIBILITY_SECONDS)
        .catch((err) => console.warn("visibility extension failed", { videoId: req.videoId, err }));
    }, HEARTBEAT_MS);

    try {
      const outputKey = `renditions/${req.videoId}/${req.profile}.mp4`;
      if (!(await this.transcoder.exists(outputKey))) {
        await this.transcoder.transcode(req.sourceKey, outputKey, req.profile);
      }
      clearInterval(heartbeat);
      await this.queue.delete(m.receiptHandle);
    } catch (err) {
      clearInterval(heartbeat);
      if (m.receiveCount >= MAX_RECEIVES) {
        await this.queue.moveToDeadLetter(m.receiptHandle, String(err));
      } else {
        await this.queue.changeVisibility(m.receiptHandle, 30 * m.receiveCount);
      }
    }
  }
}
