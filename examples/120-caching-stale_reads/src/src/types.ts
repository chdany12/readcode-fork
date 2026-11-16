export interface ListingDoc {
  id: string;
  title: string;
  description: string;
  tags: string[];
  price: number;
  updatedAt: number;
}

export interface ListingStore {
  findById(id: string): Promise<ListingDoc | null>;
  save(doc: ListingDoc): Promise<void>;
}

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface SearchIndex {
  upsert(doc: ListingDoc): Promise<void>;
}
