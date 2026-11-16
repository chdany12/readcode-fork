import { Request, Response, NextFunction } from "express";

export interface Principal {
  kind: "dispatcher" | "carrier";
  orgId: string;
}

export function requirePrincipal(req: Request, res: Response, next: NextFunction): void {
  const principal = (req as Request & { principal?: Principal }).principal;
  if (!principal) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  res.locals.principal = principal;
  next();
}
