import bcrypt from "bcrypt";
import { CustomerRepository, Customer } from "./customerRepository";
import { TokenIssuer } from "./tokens";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5V1rM3a7xJ0wQyO7dJ8b2y6n0aHhW1e";

export type LoginResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "invalid_credentials" | "locked" };

export class StorefrontLoginService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly tokens: TokenIssuer,
    private readonly now: () => number = Date.now
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const normalized = email.trim().toLowerCase();
    const customer = await this.customers.findByEmail(normalized);

    if (!customer) {
      await bcrypt.compare(password, DUMMY_HASH);
      return { ok: false, reason: "invalid_credentials" };
    }

    const matches = await bcrypt.compare(password, customer.passwordHash);

    if (matches) {
      await this.customers.resetFailedAttempts(customer.id);
      return this.issue(customer);
    }

    if (this.isLocked(customer)) {
      return { ok: false, reason: "locked" };
    }

    const attempts = await this.customers.incrementFailedAttempts(customer.id);
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await this.customers.lockUntil(customer.id, new Date(this.now() + LOCKOUT_MS));
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid_credentials" };
  }

  private isLocked(customer: Customer): boolean {
    return customer.lockedUntil !== null && customer.lockedUntil.getTime() > this.now();
  }

  private async issue(customer: Customer): Promise<LoginResult> {
    const accessToken = await this.tokens.signAccess({ sub: customer.id, scope: "orders" });
    const refreshToken = await this.tokens.createRefresh(customer.id);
    return { ok: true, accessToken, refreshToken };
  }
}
