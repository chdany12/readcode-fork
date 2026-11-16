import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotificationPreferenceError, NotificationService } from "../src/notificationService";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
const service = new NotificationService(pool);

async function countRows(table: "notifications" | "outbox", where: string, params: unknown[]) {
  const res = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
  return res.rows[0].n as number;
}

describe("NotificationService.enqueue (postgres)", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE notifications, outbox, notification_preferences RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("writes the notification and its outbox event together", async () => {
    const userId = randomUUID();
    const result = await service.enqueue({
      userId, channel: "email", templateId: "welcome", dedupeKey: `welcome:${userId}`, payload: { name: "Ada" },
    });

    expect(result.created).toBe(true);
    expect(await countRows("notifications", "id = $1", [result.id])).toBe(1);
    expect(await countRows("outbox", "aggregate_id = $1", [result.id])).toBe(1);
  });

  it("returns the existing row for a repeated dedupe key", async () => {
    const userId = randomUUID();
    const req = { userId, channel: "sms" as const, templateId: "otp", dedupeKey: `otp:${userId}:1`, payload: {} };

    const [a, b] = await Promise.all([service.enqueue(req), service.enqueue(req)]);

    expect(a.id).toBe(b.id);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(await countRows("outbox", "aggregate_id = $1", [a.id])).toBe(1);
  });

  it("rolls back everything when the user has opted out", async () => {
    const userId = randomUUID();
    await pool.query(
      "INSERT INTO notification_preferences (user_id, channel, opted_out) VALUES ($1, 'push', true)",
      [userId],
    );

    await expect(
      service.enqueue({ userId, channel: "push", templateId: "promo", dedupeKey: `promo:${userId}`, payload: {} }),
    ).rejects.toBeInstanceOf(NotificationPreferenceError);

    expect(await countRows("notifications", "user_id = $1", [userId])).toBe(0);
    expect(await countRows("outbox", "body->>'channel' = 'push'", [])).toBe(0);
  });
});
