import { LoginService, User, UserStore, PasswordHasher, SessionIssuer } from "./loginService";

class FakeUserStore implements UserStore {
  readonly rows = new Map<string, User>();
  async findByEmail(email: string) {
    const u = this.rows.get(email);
    return u ? { ...u } : undefined;
  }
  async update(user: User) { this.rows.set(user.email, { ...user }); }
}

const NOW = 1_700_000_000_000;

function build(passwordMatches: boolean) {
  const store = new FakeUserStore();
  store.rows.set("ana@example.com", {
    id: "u1", email: "ana@example.com", passwordHash: "$argon2id$stub", failedAttempts: 0,
  });
  const hasher = { compare: jest.fn().mockReturnValue(passwordMatches) } as unknown as PasswordHasher;
  const sessions: SessionIssuer = { issue: jest.fn().mockResolvedValue("sess_abc") };
  const svc = new LoginService(store, hasher, sessions, () => NOW, 3, 60_000);
  return { store, hasher, sessions, svc };
}

describe("LoginService", () => {
  it("issues a session for correct credentials", async () => {
    const { svc } = build(true);
    expect(await svc.login(" Ana@Example.com ", "pw")).toEqual({ ok: true, sessionToken: "sess_abc" });
  });

  it("counts failed attempts and locks after the limit", async () => {
    const { svc, store } = build(false);
    expect(await svc.login("ana@example.com", "bad")).toEqual({ ok: false, reason: "invalid_credentials" });
    await svc.login("ana@example.com", "bad");
    expect(await svc.login("ana@example.com", "bad")).toEqual({ ok: false, reason: "locked" });
    expect(store.rows.get("ana@example.com")?.lockedUntil).toBe(NOW + 60_000);
  });

  it("rejects a locked user without checking the password", async () => {
    const { svc, store, hasher } = build(true);
    store.rows.get("ana@example.com")!.lockedUntil = NOW + 1;
    expect(await svc.login("ana@example.com", "pw")).toEqual({ ok: false, reason: "locked" });
    expect(hasher.compare).not.toHaveBeenCalled();
  });

  it("returns the same error for unknown emails", async () => {
    const { svc, sessions } = build(true);
    expect(await svc.login("nobody@example.com", "pw")).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(sessions.issue).not.toHaveBeenCalled();
  });
});
