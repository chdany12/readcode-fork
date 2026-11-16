import { JsonLogger } from "./jsonLogger";

export interface LoginRequest {
  requestId: string;
  tenantId: string;
  username: string;
  password: string;
  ip: string;
}

export interface Credentials {
  verify(tenantId: string, username: string, password: string): Promise<{ userId: string } | null>;
}

export interface Sessions {
  issue(userId: string): Promise<{ token: string; expiresAt: string }>;
}

export class LoginService {
  constructor(
    private readonly creds: Credentials,
    private readonly sessions: Sessions,
    private readonly log: JsonLogger,
  ) {}

  async login(req: LoginRequest): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
    const log = this.log.with({ requestId: req.requestId, tenantId: req.tenantId, ip: req.ip });
    const started = Date.now();

    let user: { userId: string } | null;
    try {
      user = await this.creds.verify(req.tenantId, req.username, req.password);
    } catch (err) {
      log.error("login.verify_failed", err, { durationMs: Date.now() - started });
      return { ok: false, reason: "unavailable" };
    }

    if (!user) {
      log.warn("login.rejected", { username: req.username, durationMs: Date.now() - started });
      return { ok: false, reason: "invalid_credentials" };
    }

    const session = await this.sessions.issue(user.userId);
    log.info("login.succeeded", {
      userId: user.userId,
      session,
      durationMs: Date.now() - started,
    });
    return { ok: true, token: session.token };
  }
}
