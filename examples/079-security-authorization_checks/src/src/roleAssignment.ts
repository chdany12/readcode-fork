import {
  AuditLog,
  ConflictError,
  ForbiddenError,
  MemberRepo,
  NotFoundError,
  OrgRole,
  ROLE_RANK,
} from "./model";

export class RoleAssignmentService {
  constructor(private readonly members: MemberRepo, private readonly audit: AuditLog) {}

  async changeRole(orgId: string, actorId: string, targetUserId: string, newRole: OrgRole): Promise<void> {
    const actor = await this.members.get(orgId, actorId);
    if (!actor) {
      throw new NotFoundError("organization not found");
    }
    if (ROLE_RANK[actor.role] < ROLE_RANK.admin) {
      throw new ForbiddenError("role_management_requires_admin");
    }

    const target = await this.members.get(orgId, targetUserId);
    if (!target) {
      throw new NotFoundError("member not found");
    }
    if (target.role === newRole) {
      return;
    }

    if (ROLE_RANK[actor.role] < ROLE_RANK[target.role]) {
      throw new ForbiddenError("cannot_modify_higher_role");
    }

    if (target.role === "owner" && newRole !== "owner") {
      const owners = await this.members.countOwners(orgId);
      if (owners <= 1) {
        throw new ConflictError("last_owner");
      }
    }

    await this.members.updateRole(orgId, targetUserId, newRole);
    await this.audit.record({
      orgId,
      actorId,
      action: "member.role_changed",
      targetId: targetUserId,
      detail: { from: target.role, to: newRole },
    });
  }
}
