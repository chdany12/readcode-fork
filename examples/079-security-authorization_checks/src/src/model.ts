export type OrgRole = "member" | "billing" | "admin" | "owner";

export const ROLE_RANK: Record<OrgRole, number> = {
  member: 1,
  billing: 2,
  admin: 3,
  owner: 4,
};

export interface OrgMember {
  orgId: string;
  userId: string;
  role: OrgRole;
}

export interface MemberRepo {
  get(orgId: string, userId: string): Promise<OrgMember | null>;
  updateRole(orgId: string, userId: string, role: OrgRole): Promise<void>;
  countOwners(orgId: string): Promise<number>;
}

export interface AuditLog {
  record(event: {
    orgId: string;
    actorId: string;
    action: string;
    targetId: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
}

export class ForbiddenError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export class NotFoundError extends Error {}

export class ConflictError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
