export interface Clock {
  now(): number;
}

export interface IndexedDoc {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface ScoredHit {
  id: string;
  score: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

export class Ranker {
  constructor(
    private readonly clock: Clock,
    private readonly titleWeight = 3,
    private readonly halfLifeDays = 30,
  ) {}

  score(query: string, doc: IndexedDoc): number {
    const terms = new Set(tokenize(query));
    if (terms.size === 0) return 0;

    const titleTokens = tokenize(doc.title);
    const bodyTokens = tokenize(doc.body);
    let raw = 0;
    for (const term of terms) {
      raw += this.titleWeight * titleTokens.filter((t) => t === term).length;
      raw += bodyTokens.filter((t) => t === term).length;
    }
    if (raw === 0) return 0;

    const ageDays = Math.max(0, this.clock.now() - doc.updatedAt) / DAY_MS;
    const decay = Math.pow(0.5, ageDays / this.halfLifeDays);
    return raw * decay;
  }

  rank(query: string, docs: IndexedDoc[], limit: number): ScoredHit[] {
    return docs
      .map((d) => ({ id: d.id, score: this.score(query, d) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
