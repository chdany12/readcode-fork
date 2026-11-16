import { createHash, randomBytes } from "crypto";

export interface RefreshRecord {
  tokenHash: string;
  deviceId: string;
  userId: string;
  familyId: string;
  expiresAt: number;
  revoked: boolean;
}

export interface RefreshStore {
  findByHash(hash: string): Promise<RefreshRecord | null>;
  insert(record: RefreshRecord): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}

export interface AccessSigner {
  sign(claims: { sub: string; device: string }, ttlSeconds: number): string;
}

export class InvalidRefreshError extends Error {}

const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const ACCESS_TTL_S = 900;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SyncClientTokens {
  constructor(
    private readonly store: RefreshStore,
    private readonly signer: AccessSigner,
    private readonly now: () => number = Date.now,
  ) {}

  async issue(userId: string, deviceId: string) {
    const familyId = randomBytes(12).toString("hex");
    return this.mint(userId, deviceId, familyId);
  }

  async refresh(presented: string, deviceId: string) {
    const record = await this.store.findByHash(hash(presented));
    if (!record) throw new InvalidRefreshError("unknown token");

    if (record.revoked) {
      await this.store.revokeFamily(record.familyId);
      throw new InvalidRefreshError("token reuse detected");
    }
    if (record.expiresAt <= this.now()) {
      throw new InvalidRefreshError("expired");
    }
    if (record.deviceId !== deviceId) {
      await this.store.revokeFamily(record.familyId);
      throw new InvalidRefreshError("device mismatch");
    }

    return this.mint(record.userId, record.deviceId, record.familyId);
  }

  private async mint(userId: string, deviceId: string, familyId: string) {
    const refreshToken = randomBytes(32).toString("base64url");
    await this.store.insert({
      tokenHash: hash(refreshToken),
      deviceId,
      userId,
      familyId,
      expiresAt: this.now() + REFRESH_TTL_MS,
      revoked: false,
    });
    const accessToken = this.signer.sign({ sub: userId, device: deviceId }, ACCESS_TTL_S);
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
  }
}
