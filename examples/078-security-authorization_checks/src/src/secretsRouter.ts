import { Router, Response } from "express";
import { AuthedRequest, MembershipRepo, requireProjectRole, hasAtLeast } from "./projectAccess";

export interface PipelineSecret {
  id: string;
  projectId: string;
  name: string;
  protectedOnly: boolean;
}

export interface SecretStore {
  list(projectId: string): Promise<PipelineSecret[]>;
  get(projectId: string, secretId: string): Promise<PipelineSecret | null>;
  reveal(secretId: string): Promise<string>;
  remove(projectId: string, secretId: string): Promise<void>;
}

export function secretsRouter(memberships: MembershipRepo, secrets: SecretStore): Router {
  const router = Router({ mergeParams: true });

  router.get("/", requireProjectRole(memberships, "developer"), async (req: AuthedRequest, res: Response) => {
    const items = await secrets.list(req.params.projectId);
    res.json(items.map(({ id, name, protectedOnly }) => ({ id, name, protectedOnly })));
  });

  router.get(
    "/:secretId/value",
    requireProjectRole(memberships, "developer"),
    async (req: AuthedRequest, res: Response) => {
      const secret = await secrets.get(req.params.projectId, req.params.secretId);
      if (!secret) {
        res.status(404).json({ error: "secret_not_found" });
        return;
      }
      const role = req.membership?.role;
      const canReadProtected = req.user!.isSiteAdmin || (role !== undefined && hasAtLeast(role, "maintainer"));
      if (secret.protectedOnly && !canReadProtected) {
        res.status(403).json({ error: "protected_secret" });
        return;
      }
      const value = await secrets.reveal(secret.id);
      res.setHeader("Cache-Control", "no-store");
      res.json({ id: secret.id, name: secret.name, value });
    }
  );

  router.delete(
    "/:secretId",
    requireProjectRole(memberships, "maintainer"),
    async (req: AuthedRequest, res: Response) => {
      const secret = await secrets.get(req.params.projectId, req.params.secretId);
      if (!secret) {
        res.status(404).json({ error: "secret_not_found" });
        return;
      }
      await secrets.remove(secret.projectId, secret.id);
      res.status(204).end();
    }
  );

  return router;
}
