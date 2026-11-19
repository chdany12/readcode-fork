export interface SessionRecord {
  sessionId: string;
  principal: SearchPrincipal;
  expiresAt: number;
}

export interface SearchPrincipal {
  userId: string;
  tenantId: string;
  indexes: string[];
}

export interface SessionStore {
  get(sessionId: string): Promise<SessionRecord | null>;
  delete(sessionId: string): Promise<void>;
}

interface CachedSession {
  record: SessionRecord;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED = 50_000;

export class SessionResolver {
  private readonly cache = new Map<string, CachedSession>();

  constructor(
    private readonly store: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  async resolve(sessionId: string): Promise<SearchPrincipal | null> {
    const t = this.now();
    const cached = this.cache.get(sessionId);
    if (cached && t - cached.cachedAt < CACHE_TTL_MS) {
      return cached.record.principal;
    }
    this.cache.delete(sessionId);

    const record = await this.store.get(sessionId);
    if (!record || record.expiresAt <= t) {
      return null;
    }
    this.remember(record, t);
    return record.principal;
  }

  async revoke(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    await this.store.delete(sessionId);
  }

  private remember(record: SessionRecord, t: number): void {
    if (this.cache.size >= MAX_CACHED) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(record.sessionId, { record, cachedAt: t });
  }
}
