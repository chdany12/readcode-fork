import { LoginThrottle } from "./loginThrottle";

export interface CredentialVerifier {
  verify(username: string, password: string): Promise<{ userId: string } | null>;
}

export type LoginResult =
  | { status: "ok"; userId: string }
  | { status: "invalid" }
  | { status: "locked"; retryAfterSeconds: number };

export class LoginService {
  constructor(
    private readonly throttle: LoginThrottle,
    private readonly verifier: CredentialVerifier,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const gate = await this.throttle.check(username);
    if (!gate.allowed) {
      return { status: "locked", retryAfterSeconds: gate.retryAfterSeconds };
    }

    const user = await this.verifier.verify(username, password);
    if (!user) {
      await this.throttle.recordFailure(username);
      return { status: "invalid" };
    }

    await this.throttle.recordSuccess(username);
    return { status: "ok", userId: user.userId };
  }
}
