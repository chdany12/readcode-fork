import { Pool } from "pg";

export interface DirectoryUser {
  id: string;
  email: string;
  display_name: string;
  status: "active" | "suspended" | "deprovisioned";
  mfa_enrolled: boolean;
  last_login_at: Date | null;
  roles: string[];
}

export class DirectoryRepo {
  constructor(private readonly pool: Pool) {}

  async *iterateTenantUsers(tenantId: string, pageSize = 500): AsyncGenerator<DirectoryUser> {
    let afterId = "";
    for (;;) {
      const { rows } = await this.pool.query<DirectoryUser>(
        `SELECT u.id, u.email, u.display_name, u.status, u.mfa_enrolled, u.last_login_at,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
           FROM users u
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.id = ur.role_id
          WHERE u.tenant_id = $1 AND u.id > $2
          GROUP BY u.id
          ORDER BY u.id
          LIMIT $3`,
        [tenantId, afterId, pageSize],
      );
      if (rows.length === 0) return;
      for (const row of rows) yield row;
      afterId = rows[rows.length - 1].id;
      if (rows.length < pageSize) return;
    }
  }
}
