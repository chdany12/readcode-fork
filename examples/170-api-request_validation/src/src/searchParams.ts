import { ValidationError } from "./errors";

export const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 256;
const SORTABLE_FIELDS = new Set(["relevance", "published_at", "title"]);
const FILTERABLE_FIELDS = new Set(["category", "author", "language"]);

export interface SearchParams {
  q: string;
  limit: number;
  offset: number;
  sort: string;
  filters: Record<string, string>;
}

export function parseSearchParams(query: Record<string, string | undefined>): SearchParams {
  const q = (query.q ?? "").trim();
  if (q.length === 0) throw new ValidationError("q", "query must not be empty");
  if (q.length > MAX_QUERY_LENGTH) throw new ValidationError("q", `query longer than ${MAX_QUERY_LENGTH}`);

  const limit = query.limit === undefined ? DEFAULT_PAGE_SIZE : parseInt(query.limit, 10);
  if (limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new ValidationError("limit", `limit must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    throw new ValidationError("offset", "offset must be an integer between 0 and 10000");
  }

  const sort = query.sort ?? "relevance";
  if (!SORTABLE_FIELDS.has(sort)) throw new ValidationError("sort", `cannot sort by ${sort}`);

  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("filter.") || value === undefined) continue;
    const field = key.slice("filter.".length);
    if (!FILTERABLE_FIELDS.has(field)) throw new ValidationError(key, `unknown filter ${field}`);
    if (value.length > 128) throw new ValidationError(key, "filter value too long");
    filters[field] = value;
  }

  return { q, limit, offset, sort, filters };
}
