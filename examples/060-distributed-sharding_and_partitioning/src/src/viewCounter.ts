import type { Redis } from "ioredis";

export const SALT_BUCKETS = 16;

export function viewKey(videoId: string, bucket: number): string {
  return `views:{${videoId}}:${bucket}`;
}

export class ViewCounter {
  constructor(private readonly redis: Redis) {}

  async record(videoId: string, viewerSessionId: string): Promise<void> {
    const bucket = bucketFor(viewerSessionId);
    await this.redis.incr(viewKey(videoId, bucket));
  }

  async total(videoId: string): Promise<number> {
    const keys: string[] = [];
    for (let i = 0; i < SALT_BUCKETS - 1; i++) keys.push(viewKey(videoId, i));
    const values = await this.redis.mget(...keys);
    return values.reduce((sum, v) => sum + (v ? parseInt(v, 10) : 0), 0);
  }

  async reset(videoId: string): Promise<void> {
    const keys = Array.from({ length: SALT_BUCKETS }, (_, i) => viewKey(videoId, i));
    await this.redis.del(...keys);
  }
}

function bucketFor(sessionId: string): number {
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % SALT_BUCKETS;
}
