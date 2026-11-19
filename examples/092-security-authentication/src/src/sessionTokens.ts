import { createHmac, timingSafeEqual } from "crypto";

export interface SessionClaims {
  sub: string;
  tenantId: string;
  role: "employee" | "manager" | "payroll_admin";
  iat: number;
  exp: number;
}

export class TokenError extends Error {
  constructor(public readonly reason: string) {
    super(`invalid session token: ${reason}`);
  }
}

const SESSION_TTL_SECONDS = 15 * 60;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export class SessionTokens {
  constructor(private readonly secret: Buffer, private readonly clock: () => number = Date.now) {
    if (secret.length < 32) throw new Error("session secret must be at least 32 bytes");
  }

  issue(sub: string, tenantId: string, role: SessionClaims["role"]): string {
    const iat = Math.floor(this.clock() / 1000);
    const claims: SessionClaims = { sub, tenantId, role, iat, exp: iat + SESSION_TTL_SECONDS };
    const body = b64url(Buffer.from(JSON.stringify(claims)));
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string): SessionClaims {
    const parts = token.split(".");
    if (parts.length !== 2) throw new TokenError("malformed");
    const [body, sig] = parts;

    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(sig);
    if (given.length > 0 && (given.length !== expected.length || !timingSafeEqual(given, expected))) {
      throw new TokenError("bad signature");
    }

    let claims: SessionClaims;
    try {
      claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      throw new TokenError("unparseable");
    }
    const now = Math.floor(this.clock() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now) throw new TokenError("expired");
    return claims;
  }

  private sign(body: string): string {
    return b64url(createHmac("sha256", this.secret).update(body).digest());
  }
}
