import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FeedService, ForbiddenError } from "../src/feedService";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const feed = new FeedService(pool);

async function seedUser(handle: string): Promise<string> {
  const id = randomUUID();
  await pool.query("INSERT INTO users (id, handle) VALUES ($1, $2)", [id, `${handle}-${id.slice(0, 8)}`]);
  return id;
}

async function seedPost(authorId: string, body: string, createdAt: string, deleted = false) {
  await pool.query(
    "INSERT INTO posts (id, author_id, body, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), authorId, body, createdAt, deleted ? createdAt : null],
  );
}

describe("FeedService.getFeed (postgres)", () => {
  let reader: string;
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    await pool.query("TRUNCATE posts, follows, user_blocks, users CASCADE");
    reader = await seedUser("reader");
    alice = await seedUser("alice");
    bob = await seedUser("bob");
    await pool.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2), ($1, $3)", [reader, alice, bob]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns followed authors' posts newest first and hides deleted ones", async () => {
    await seedPost(alice, "a1", "2024-05-01T10:00:00Z");
    await seedPost(bob, "b1", "2024-05-01T11:00:00Z");
    await seedPost(alice, "a2-deleted", "2024-05-01T12:00:00Z", true);

    const items = await feed.getFeed(reader, reader);

    expect(items.map((i) => i.body)).toEqual(["b1", "a1"]);
  });

  it("pages with a created_at cursor without repeating items", async () => {
    for (let i = 0; i < 5; i++) {
      await seedPost(alice, `p${i}`, `2024-05-02T0${i}:00:00Z`);
    }
    const first = await feed.getFeed(reader, reader, 2);
    const second = await feed.getFeed(reader, reader, 2, first[first.length - 1].createdAt);

    expect(first.map((i) => i.body)).toEqual(["p4", "p3"]);
    expect(second.map((i) => i.body)).toEqual(["p2", "p1"]);
  });

  it("rejects a viewer the owner has blocked", () => {
    const stranger = randomUUID();
    pool.query("INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)", [reader, stranger]);
    expect(feed.getFeed(stranger, reader)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
