import { FlagEvaluator } from "./flags";

export interface LoginAttempt {
  userId: string;
  tenantId: string;
  passwordOk: boolean;
  hasWebAuthn: boolean;
  hasTotp: boolean;
}

export type LoginOutcome =
  | { status: "denied"; reason: string }
  | { status: "challenge"; method: "webauthn" | "totp" }
  | { status: "granted" };

export class LoginPolicy {
  constructor(private readonly flags: FlagEvaluator) {}

  decide(a: LoginAttempt): LoginOutcome {
    if (!a.passwordOk) return { status: "denied", reason: "invalid_credentials" };
    const ctx = { userId: a.userId, tenantId: a.tenantId };

    if (this.flags.isEnabled("passkey-first-login", ctx) && a.hasWebAuthn) {
      return { status: "challenge", method: "webauthn" };
    }
    if (a.hasTotp) {
      return { status: "challenge", method: "totp" };
    }
    if (this.flags.isEnabled("require-mfa-enrollment", ctx)) {
      return { status: "denied", reason: "mfa_enrollment_required" };
    }
    return { status: "granted" };
  }
}
