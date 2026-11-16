import type { Cache, ListingDoc, ListingStore, SearchIndex } from "./types";

const DOC_TTL_SECONDS = 3600;

export class ListingNotFound extends Error {
  constructor(id: string) {
    super(`listing ${id} not found`);
    this.name = "ListingNotFound";
  }
}

export interface ListingPatch {
  title?: string;
  description?: string;
  tags?: string[];
  price?: number;
}

export class ListingService {
  constructor(
    private readonly primary: ListingStore,
    private readonly replica: ListingStore,
    private readonly cache: Cache,
    private readonly index: SearchIndex,
    private readonly now: () => number = Date.now,
  ) {}

  private key(id: string): string {
    return `listing:v3:${id}`;
  }

  async get(id: string): Promise<ListingDoc> {
    const hit = await this.cache.get(this.key(id));
    if (hit) {
      return JSON.parse(hit) as ListingDoc;
    }
    const doc = await this.replica.findById(id);
    if (!doc) {
      throw new ListingNotFound(id);
    }
    await this.cache.set(this.key(id), JSON.stringify(doc), DOC_TTL_SECONDS);
    return doc;
  }

  async update(id: string, patch: ListingPatch): Promise<ListingDoc> {
    const current = await this.primary.findById(id);
    if (!current) {
      throw new ListingNotFound(id);
    }
    const next: ListingDoc = {
      ...current,
      ...patch,
      tags: patch.tags ? [...new Set(patch.tags.map((t) => t.toLowerCase()))] : current.tags,
      updatedAt: this.now(),
    };
    await this.primary.save(next);
    await this.cache.del(this.key(id));
    await this.reindex(id);
    return next;
  }

  private async reindex(id: string): Promise<void> {
    const fresh = await this.get(id);
    await this.index.upsert(fresh);
  }
}
