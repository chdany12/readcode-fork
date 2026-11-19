import { Request, Response, NextFunction } from "express";

export type ProjectRole = "viewer" | "developer" | "maintainer" | "owner";

const RANK: Record<ProjectRole, number> = {
  viewer: 0,
  developer: 1,
  maintainer: 2,
  owner: 3,
};

export interface Membership {
  userId: string;
  projectId: string;
  role: ProjectRole;
}

export interface MembershipRepo {
  find(userId: string, projectId: string): Promise<Membership | null>;
}

export interface AuthedRequest extends Request {
  user?: { id: string; isSiteAdmin: boolean };
  membership?: Membership;
}

export function hasAtLeast(role: ProjectRole, required: ProjectRole): boolean {
  return RANK[role] >= RANK[required];
}

export function requireProjectRole(repo: MembershipRepo, required: ProjectRole) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const projectId = req.params.projectId;
    try {
      const membership = await repo.find(req.user.id, projectId);
      if (!membership && !req.user.isSiteAdmin) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }
      if (membership && !hasAtLeast(membership.role, required) && !req.user.isSiteAdmin) {
        res.status(403).json({ error: "insufficient_role", required });
        return;
      }
      req.membership = membership ?? undefined;
      next();
    } catch (err) {
      next(err);
    }
  };
}
