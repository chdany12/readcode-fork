import type { Request, Response } from "express";
import { DirectoryRepo, DirectoryUser } from "./directoryRepo";

function toExportRow(u: DirectoryUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.display_name,
    status: u.status,
    mfa: u.mfa_enrolled,
    lastLogin: u.last_login_at ? u.last_login_at.toISOString() : null,
    roles: u.roles,
  };
}

export function makeUserExportHandler(repo: DirectoryRepo) {
  return async function exportUsers(req: Request, res: Response): Promise<void> {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId || !req.headers.authorization) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Content-Disposition", `attachment; filename="users-${tenantId}.ndjson"`);

    let count = 0;
    try {
      for await (const user of repo.iterateTenantUsers(tenantId)) {
        if (aborted) break;
        res.write(JSON.stringify(toExportRow(user)) + "\n");
        count++;
      }
      if (!aborted) {
        res.end();
      }
      console.info(JSON.stringify({ msg: "user export finished", tenantId, count, aborted }));
    } catch (err) {
      console.error(JSON.stringify({ msg: "user export failed", tenantId, count, error: String(err) }));
      res.destroy(err as Error);
    }
  };
}
