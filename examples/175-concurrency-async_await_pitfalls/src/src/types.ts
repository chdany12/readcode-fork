export interface ProductDoc {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
}

export interface CatalogStore {
  listChangedSince(cursor: string, limit: number): Promise<{ docs: ProductDoc[]; nextCursor: string | null }>;
}

export interface SearchIndex {
  upsert(id: string, fields: Record<string, unknown>): Promise<void>;
  refresh(): Promise<void>;
}

export interface CursorStore {
  load(job: string): Promise<string>;
  save(job: string, cursor: string): Promise<void>;
}

export interface Tokenizer {
  analyze(text: string): Promise<string[]>;
}
