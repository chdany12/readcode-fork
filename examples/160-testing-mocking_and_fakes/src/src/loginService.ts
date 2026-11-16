export interface User {
  id: string;
  email: string;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil?: number;
}

export interface UserStore {
  findByEmail(email: string): Promise<User | undefined>;
  update(user: User): Promise<void>;
}

export interface PasswordHasher {
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface SessionIssuer {
  issue(userId: string): Promise<string>;
}

export type LoginResult =
  | { ok: true; sessionToken: string }
  | { ok: false; reason: "invalid_credentials" | "locked" };

export class LoginService {
  constructor(
    private readonly users: UserStore,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly now: () => number = Date.now,
    private readonly maxAttempts = 5,
    private readonly lockMs = 15 * 60_000,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) return { ok: false, reason: "invalid_credentials" };

    if (user.lockedUntil && user.lockedUntil > this.now()) {
      return { ok: false, reason: "locked" };
    }

    if (!this.hasher.compare(password, user.passwordHash)) {
      const failedAttempts = user.failedAttempts + 1;
      const lockedUntil = failedAttempts >= this.maxAttempts ? this.now() + this.lockMs : undefined;
      await this.users.update({ ...user, failedAttempts, lockedUntil });
      return { ok: false, reason: lockedUntil ? "locked" : "invalid_credentials" };
    }

    if (user.failedAttempts > 0 || user.lockedUntil) {
      await this.users.update({ ...user, failedAttempts: 0, lockedUntil: undefined });
    }
    return { ok: true, sessionToken: await this.sessions.issue(user.id) };
  }
}
