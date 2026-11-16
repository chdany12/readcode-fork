import type { Request, Response } from "express";
import { DirectoryClient, groupsWithRetry } from "./directory";

export interface PolicyStore {
  rolesForGroups(groups: string[], opts: { signal: AbortSignal }): Promise<string[]>;
}

export function effectivePermissionsHandler(dir: DirectoryClient, policies: PolicyStore) {
  return async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.userId;
    const ctrl = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) ctrl.abort(new Error("client disconnected"));
    };
    req.on("close", onClose);
    const deadline = setTimeout(() => ctrl.abort(new Error("deadline exceeded")), 2_000);

    try {
      const groups = await groupsWithRetry(dir, userId, ctrl.signal);
      const roles = await policies.rolesForGroups(groups, { signal: ctrl.signal });
      res.json({ userId, groups, roles });
    } catch (err) {
      if (ctrl.signal.aborted) {
        if (!res.headersSent && !res.destroyed) res.status(504).json({ error: "timeout" });
        return;
      }
      res.status(502).json({ error: "directory unavailable" });
    } finally {
      clearTimeout(deadline);
      req.off("close", onClose);
    }
  };
}
