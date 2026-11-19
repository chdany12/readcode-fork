import Redis from "ioredis";
import { TranscodeConsumer } from "./consumer";
import { createTranscoder } from "./ffmpegTranscoder";
import { subscribe } from "./queue";
import { logger } from "./logger";

const redis = new Redis(process.env.REDIS_URL!);
const consumer = new TranscodeConsumer(redis, createTranscoder(), logger);

subscribe("video.transcode.requested", { concurrency: 4 }, (msg) => consumer.handle(msg));

process.on("SIGTERM", async () => {
  logger.info("shutting down transcode worker");
  await redis.quit();
  process.exit(0);
});
