import { test } from "node:test";
import assert from "node:assert/strict";
import { PushBatcher, PushGateway, PushMessage } from "./pushBatcher";

class RecordingGateway implements PushGateway {
  batches: PushMessage[][] = [];
  async sendBatch(messages: PushMessage[]): Promise<void> {
    this.batches.push(messages);
  }
}

const msg = (n: number): PushMessage => ({
  userId: `u-${n}`,
  title: "New reply",
  body: `Reply #${n}`,
});

test("flushes immediately when the batch is full", async () => {
  const gateway = new RecordingGateway();
  const batcher = new PushBatcher(gateway, { flushIntervalMs: 10_000, maxBatchSize: 3 });

  batcher.enqueue(msg(1));
  batcher.enqueue(msg(2));
  batcher.enqueue(msg(3));
  await batcher.drain();

  assert.equal(gateway.batches.length, 1);
  assert.equal(gateway.batches[0].length, 3);
});

test("flushes a partial batch after the interval", async () => {
  const gateway = new RecordingGateway();
  const batcher = new PushBatcher(gateway, { flushIntervalMs: 50, maxBatchSize: 100 });

  batcher.enqueue(msg(1));
  batcher.enqueue(msg(2));
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(gateway.batches.length, 1);
  assert.deepEqual(gateway.batches[0].map((m) => m.userId), ["u-1", "u-2"]);
});

test("drain sends whatever is pending", async () => {
  const gateway = new RecordingGateway();
  const batcher = new PushBatcher(gateway, { flushIntervalMs: 10_000, maxBatchSize: 100 });

  batcher.enqueue(msg(7));
  await batcher.drain();

  assert.equal(gateway.batches.length, 1);
  assert.equal(gateway.batches[0][0].userId, "u-7");
});

test("reports gateway failures without throwing", async () => {
  const failing: PushGateway = {
    sendBatch: async () => { throw new Error("APNs unavailable"); },
  };
  const batcher = new PushBatcher(failing, { flushIntervalMs: 10_000, maxBatchSize: 100 });
  const errors: unknown[] = [];
  batcher.on("flushError", (err) => errors.push(err));

  batcher.enqueue(msg(1));
  await batcher.drain();

  assert.equal(errors.length, 1);
});
