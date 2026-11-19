import { test } from "node:test";
import assert from "node:assert/strict";
import { BlobStore, digestOf, LocalFile, syncFolder } from "./syncFolder";

class LatentBlobStore implements BlobStore {
  blobs = new Map<string, Buffer>();
  putCalls = 0;

  private latency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  }

  async has(digest: string): Promise<boolean> {
    await this.latency();
    return this.blobs.has(digest);
  }

  async put(digest: string, bytes: Buffer): Promise<void> {
    await this.latency();
    this.putCalls++;
    this.blobs.set(digest, bytes);
  }
}

const file = (path: string, text: string): LocalFile => ({ path, bytes: Buffer.from(text) });

test("uploads every new file", async () => {
  const store = new LatentBlobStore();
  const files = [file("a.txt", "alpha"), file("b.txt", "beta"), file("c.txt", "gamma")];

  const result = await syncFolder(files, store, 3);

  assert.deepEqual(result.uploaded, ["a.txt", "b.txt", "c.txt"]);
  assert.equal(store.putCalls, 3);
});

test("skips files whose content is already stored", async () => {
  const store = new LatentBlobStore();
  store.blobs.set(digestOf(Buffer.from("alpha")), Buffer.from("alpha"));
  const files = [file("a.txt", "alpha"), file("b.txt", "beta")];

  const result = await syncFolder(files, store, 2);

  assert.deepEqual(result.skipped, ["a.txt"]);
  assert.deepEqual(result.uploaded, ["b.txt"]);
});

test("handles an empty folder", async () => {
  const store = new LatentBlobStore();
  const result = await syncFolder([], store);
  assert.deepEqual(result, { uploaded: [], skipped: [] });
  assert.equal(store.putCalls, 0);
});
