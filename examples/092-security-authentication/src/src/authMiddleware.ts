import type { Request, Response, NextFunction } from "express";
import { SessionTokens, TokenError, SessionClaims } from "./sessionTokens";

declare module "express-serve-static-core" {
  interface Request {
    session?: SessionClaims;
  }
}

export function requireSession(tokens: SessionTokens) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const match = /^Bearer\s+(\S+)$/.exec(header);
    if (!match) {
      res.status(401).json({ error: "missing_credentials" });
      return;
    }
    try {
      req.session = tokens.verify(match[1]);
    } catch (err) {
      if (err instanceof TokenError) {
        res.status(401).json({ error: "invalid_session" });
        return;
      }
      next(err);
      return;
    }
    next();
  };
}

export function requireRole(...roles: SessionClaims["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
      res.status(401).json({ error: "missing_credentials" });
      return;
    }
    if (!roles.includes(req.session.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
