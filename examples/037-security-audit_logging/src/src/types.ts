export interface AdminSession {
  adminId: string;
  roles: ReadonlySet<string>;
  ip: string;
}

export interface PlayerBan {
  playerId: string;
  bannedUntil: Date | null;
  reason: string;
}

export interface AuditEntry {
  id: string;
  at: Date;
  adminId: string;
  sourceIp: string;
  action: "player.ban" | "player.unban";
  target: string;
  result: "applied" | "rejected";
  detail: Record<string, string | number | null>;
}

export interface Tx {
  getBan(playerId: string): Promise<PlayerBan | null>;
  upsertBan(ban: PlayerBan): Promise<void>;
  deleteBan(playerId: string): Promise<void>;
  insertAudit(entry: AuditEntry): Promise<void>;
}

export interface Db {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  insertAudit(entry: AuditEntry): Promise<void>;
}
