import type { Redis } from "ioredis";

export type SessionStatus = "active" | "revoked" | "unknown";

export class DriverDirectory {
  constructor(private readonly redis: Redis) {}

  async sessionStatus(driverId: string, sessionId: string): Promise<SessionStatus> {
    const value = await this.redis.get(`driver:${driverId}:session:${sessionId}`);
    if (value === null) return "unknown";
    return value === "active" ? "active" : "revoked";
  }

  async revoke(driverId: string, sessionId: string): Promise<void> {
    await this.redis.set(`driver:${driverId}:session:${sessionId}`, "revoked", "EX", 86400);
  }
}
