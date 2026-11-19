import { DirectoryRepository, RoleGrant } from "./directoryRepository";

export interface AccessReviewEntry {
  email: string;
  status: string;
  mfaEnrolled: boolean;
  lastLogin: Date | null;
  stale: boolean;
  roles: { role: string; grantedBy: string | null; grantedAt: Date }[];
}

const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

export class AccessReviewService {
  constructor(
    private readonly repo: DirectoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async quarterlyReview(orgId: string): Promise<AccessReviewEntry[]> {
    const members = await this.repo.membersOfOrg(orgId);
    const ids = members.map((m) => m.userId);
    const [grants, logins] = await Promise.all([
      this.repo.grantsForUsers(orgId, ids),
      this.repo.lastLoginsForUsers(ids),
    ]);

    const grantsByUser = new Map<string, RoleGrant[]>();
    for (const g of grants) {
      const list = grantsByUser.get(g.userId) ?? [];
      list.push(g);
      grantsByUser.set(g.userId, list);
    }

    const cutoff = this.now().getTime() - STALE_AFTER_MS;
    const entries: AccessReviewEntry[] = [];
    for (const member of members) {
      const lastLogin = logins.get(member.userId) ?? null;
      const roles = [];
      for (const g of grantsByUser.get(member.userId) ?? []) {
        roles.push({
          role: g.roleName,
          grantedBy: g.grantedBy ? await this.repo.grantorEmail(g.grantedBy) : null,
          grantedAt: g.grantedAt,
        });
      }
      entries.push({
        email: member.email,
        status: member.status,
        mfaEnrolled: member.mfaEnrolled,
        lastLogin,
        stale: lastLogin === null || lastLogin.getTime() < cutoff,
        roles,
      });
    }
    return entries;
  }
}
