import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JobState,
  Sleeper,
  TranscodeStatus,
  TranscodeTimeoutError,
  TranscoderApi,
  waitForRenditions,
} from "./waitForRenditions";

class ScriptedTranscoder implements TranscoderApi {
  calls = 0;
  constructor(private readonly script: JobState[], private readonly renditions: string[]) {}
  async getStatus(jobId: string): Promise<TranscodeStatus> {
    const state = this.script[Math.min(this.calls, this.script.length - 1)];
    this.calls++;
    return { jobId, state, renditions: state === "ready" ? this.renditions : [] };
  }
}

class RecordingSleeper implements Sleeper {
  waits: number[] = [];
  async sleep(ms: number): Promise<void> {
    this.waits.push(ms);
  }
}

const opts = { intervalMs: 2_000, maxPolls: 4 };

test("returns sorted renditions once the job is ready", async () => {
  const api = new ScriptedTranscoder(["queued", "transcoding", "ready"], ["720p", "1080p", "480p"]);
  const sleeper = new RecordingSleeper();

  const result = await waitForRenditions(api, "job-1", opts, sleeper);

  assert.deepEqual(result, ["1080p", "480p", "720p"]);
  assert.equal(api.calls, 3);
  assert.deepEqual(sleeper.waits, [2_000, 2_000]);
});

test("stops polling when the job fails", async () => {
  const api = new ScriptedTranscoder(["transcoding", "failed"], []);
  const sleeper = new RecordingSleeper();

  await assert.rejects(waitForRenditions(api, "job-2", opts, sleeper), /job-2 failed/);
  assert.equal(api.calls, 2);
});

test("gives up after maxPolls without a trailing sleep", async () => {
  const api = new ScriptedTranscoder(["transcoding"], []);
  const sleeper = new RecordingSleeper();

  await assert.rejects(
    waitForRenditions(api, "job-3", opts, sleeper),
    (err: unknown) => err instanceof TranscodeTimeoutError && err.attempts === 4,
  );
  assert.equal(api.calls, 4);
  assert.equal(sleeper.waits.length, 3);
});
