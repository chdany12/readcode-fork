import { randomUUID } from "node:crypto";
import { AdminSession, AuditEntry, Db } from "./types";

export class ModerationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const MAX_BAN_DAYS = 365;

export class ModerationService {
  constructor(private readonly db: Db, private readonly clock: () => Date = () => new Date()) {}

  private entry(
    session: AdminSession,
    action: AuditEntry["action"],
    target: string,
    result: AuditEntry["result"],
    detail: AuditEntry["detail"],
  ): AuditEntry {
    return {
      id: randomUUID(),
      at: this.clock(),
      adminId: session.adminId,
      sourceIp: session.ip,
      action,
      target,
      result,
      detail,
    };
  }

  async banPlayer(session: AdminSession, playerId: string, days: number | null, reason: string): Promise<void> {
    if (!session.roles.has("moderator")) {
      await this.db.insertAudit(
        this.entry(session, "player.ban", playerId, "rejected", { cause: "missing_role" }),
      );
      throw new ModerationError("forbidden", 403);
    }
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > MAX_BAN_DAYS)) {
      throw new ModerationError(`days must be 1-${MAX_BAN_DAYS} or null`, 400);
    }

    const now = this.clock();
    const bannedUntil = days === null ? null : new Date(now.getTime() + days * 86_400_000);

    await this.db.transaction(async (tx) => {
      const existing = await tx.getBan(playerId);
      await tx.upsertBan({ playerId, bannedUntil, reason });
      await tx.insertAudit(
        this.entry(session, "player.ban", playerId, "applied", {
          previousUntil: existing ? existing.bannedUntil?.toISOString() ?? "permanent" : null,
          newUntil: bannedUntil?.toISOString() ?? "permanent",
          reason,
        }),
      );
    });
  }

  async unbanPlayer(session: AdminSession, playerId: string): Promise<boolean> {
    if (!session.roles.has("moderator")) {
      await this.db.insertAudit(
        this.entry(session, "player.unban", playerId, "rejected", { cause: "missing_role" }),
      );
      throw new ModerationError("forbidden", 403);
    }

    return this.db.transaction(async (tx) => {
      const existing = await tx.getBan(playerId);
      if (!existing) {
        return false;
      }
      await tx.deleteBan(playerId);
      await tx.insertAudit(
        this.entry(session, "player.unban", playerId, "applied", {
          previousUntil: existing.bannedUntil?.toISOString() ?? "permanent",
          previousReason: existing.reason,
        }),
      );
      return true;
    });
  }
}
