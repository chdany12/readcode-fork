import { Pool } from "pg";

export interface MemberRow {
  userId: string;
  email: string;
  status: "active" | "suspended";
  mfaEnrolled: boolean;
}

export interface RoleGrant {
  userId: string;
  roleName: string;
  grantedBy: string | null;
  grantedAt: Date;
}

export class DirectoryRepository {
  constructor(private readonly pool: Pool) {}

  async membersOfOrg(orgId: string): Promise<MemberRow[]> {
    const { rows } = await this.pool.query(
      `SELECT u.id AS "userId", u.email, m.status, u.mfa_enrolled AS "mfaEnrolled"
         FROM org_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.org_id = $1
        ORDER BY u.email`,
      [orgId],
    );
    return rows;
  }

  async grantsForUsers(orgId: string, userIds: string[]): Promise<RoleGrant[]> {
    if (userIds.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT g.user_id AS "userId", r.name AS "roleName", g.granted_by AS "grantedBy",
              g.granted_at AS "grantedAt"
         FROM role_grants g
         JOIN roles r ON r.id = g.role_id
        WHERE g.org_id = $1 AND g.user_id = ANY($2)`,
      [orgId, userIds],
    );
    return rows;
  }

  async lastLoginsForUsers(userIds: string[]): Promise<Map<string, Date>> {
    if (userIds.length === 0) return new Map();
    const { rows } = await this.pool.query(
      `SELECT user_id AS "userId", MAX(created_at) AS "lastLogin"
         FROM login_events
        WHERE user_id = ANY($1) AND outcome = 'success'
        GROUP BY user_id`,
      [userIds],
    );
    return new Map(rows.map((r: { userId: string; lastLogin: Date }) => [r.userId, r.lastLogin]));
  }

  async grantorEmail(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    return rows[0]?.email ?? null;
  }
}
