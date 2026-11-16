import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Clock, FeedService, FollowGraph, systemClock } from "./feedService";

class SteppingClock implements Clock {
  constructor(private t = 1_700_000_000_000) {}
  now(): number {
    this.t += 1_000;
    return this.t;
  }
}

class StaticFollows implements FollowGraph {
  constructor(private readonly edges: Record<string, string[]>) {}
  async followeesOf(userId: string): Promise<string[]> {
    return this.edges[userId] ?? [];
  }
}

describe("FeedService.homeFeed", () => {
  let follows: StaticFollows;

  beforeEach(() => {
    follows = new StaticFollows({ alice: ["bob", "carol"], bob: [] });
  });

  it("includes the user's own posts and their followees' posts", async () => {
    const feed = new FeedService(follows, new SteppingClock());
    feed.publish("alice", "hello");
    feed.publish("bob", "hi alice");
    feed.publish("dave", "not followed");

    const items = await feed.homeFeed("alice");
    assert.deepEqual(items.map((p) => p.authorId).sort(), ["alice", "bob"]);
  });

  it("orders posts newest first", async () => {
    const feed = new FeedService(follows, systemClock);
    const first = feed.publish("bob", "first");
    const second = feed.publish("carol", "second");

    const items = await feed.homeFeed("alice");
    assert.deepEqual(items.map((p) => p.id), [second.id, first.id]);
  });

  it("respects the limit", async () => {
    const feed = new FeedService(follows, new SteppingClock());
    for (let i = 0; i < 5; i++) feed.publish("carol", `post ${i}`);

    const items = await feed.homeFeed("alice", 3);
    assert.equal(items.length, 3);
    assert.equal(items[0].text, "post 4");
  });

  it("rejects empty posts", () => {
    const feed = new FeedService(follows, new SteppingClock());
    assert.throws(() => feed.publish("alice", "   "), /empty post/);
  });
});
