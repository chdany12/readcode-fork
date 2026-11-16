import { Router, Request, Response, NextFunction } from "express";
import { RoleAssignmentService } from "./roleAssignment";
import { ConflictError, ForbiddenError, NotFoundError, OrgRole, ROLE_RANK } from "./model";

interface AuthedRequest extends Request {
  session?: { userId: string };
}

export function memberRoutes(service: RoleAssignmentService): Router {
  const router = Router();

  router.put("/orgs/:orgId/members/:userId/role", async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const role = req.body?.role as OrgRole;
    if (!(role in ROLE_RANK)) {
      res.status(400).json({ error: "invalid_role" });
      return;
    }
    try {
      await service.changeRole(req.params.orgId, req.session.userId, req.params.userId, role);
      res.status(204).end();
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: "not_found" });
      } else if (err instanceof ForbiddenError) {
        res.status(403).json({ error: err.code });
      } else if (err instanceof ConflictError) {
        res.status(409).json({ error: err.code });
      } else {
        next(err);
      }
    }
  });

  return router;
}
