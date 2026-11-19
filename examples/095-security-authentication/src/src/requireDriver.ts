import jwt, { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { DriverDirectory } from "./driverDirectory";

export interface DriverTokenConfig {
  publicKey: string;
  issuer: string;
  audience: string;
  clockToleranceSec: number;
}

export interface DriverPrincipal {
  driverId: string;
  sessionId: string;
}

export interface DriverRequest extends Request {
  driver?: DriverPrincipal;
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

export function requireDriver(cfg: DriverTokenConfig, directory: DriverDirectory) {
  return async (req: DriverRequest, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return res.status(401).json({ error: "missing_token" });
    }

    let claims: JwtPayload;
    try {
      claims = jwt.verify(token, cfg.publicKey, {
        algorithms: ["RS256"],
        issuer: cfg.issuer,
        audience: cfg.audience,
        clockTolerance: cfg.clockToleranceSec,
      }) as JwtPayload;
    } catch (err) {
      const code = err instanceof TokenExpiredError ? "token_expired" : "invalid_token";
      res.setHeader("WWW-Authenticate", `Bearer error="invalid_token"`);
      return res.status(401).json({ error: code });
    }

    if (claims.typ !== "driver" || typeof claims.sub !== "string" || typeof claims.sid !== "string") {
      return res.status(401).json({ error: "invalid_token" });
    }

    try {
      const status = await directory.sessionStatus(claims.sub, claims.sid);
      if (status !== "active") {
        return res.status(401).json({ error: "session_revoked" });
      }
    } catch (err) {
      req.log?.warn({ err }, "driver directory unavailable");
      return res.status(503).json({ error: "auth_unavailable" });
    }

    req.driver = { driverId: claims.sub, sessionId: claims.sid };
    next();
  };
}
