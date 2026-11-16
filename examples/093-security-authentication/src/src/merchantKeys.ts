import type { Pool } from "pg";

export interface MerchantKey {
  keyId: string;
  merchantId: string;
  secret: string;
  revokedAt: Date | null;
}

export interface MerchantKeyStore {
  findActive(keyId: string): Promise<MerchantKey | null>;
}

export class PgMerchantKeyStore implements MerchantKeyStore {
  constructor(private readonly pool: Pool) {}

  async findActive(keyId: string): Promise<MerchantKey | null> {
    const { rows } = await this.pool.query(
      `SELECT key_id, merchant_id, secret, revoked_at
         FROM merchant_api_keys
        WHERE key_id = $1 AND revoked_at IS NULL`,
      [keyId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      keyId: r.key_id,
      merchantId: r.merchant_id,
      secret: r.secret,
      revokedAt: r.revoked_at,
    };
  }
}
