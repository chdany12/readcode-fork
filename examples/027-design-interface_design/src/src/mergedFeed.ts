import { FeedItem, FeedPage, FeedSource, compareFeedItems } from "./feedSource";

interface SourceState {
  cursor: string | null;
  buffer: FeedItem[];
  exhausted: boolean;
}

type MergedCursor = Record<string, SourceState>;

export class MergedFeed {
  constructor(private readonly sources: readonly FeedSource[]) {
    const keys = new Set(sources.map((s) => s.key));
    if (keys.size !== sources.length) {
      throw new Error("feed source keys must be unique");
    }
  }

  async fetchPage(viewerId: string, cursor: string | null, limit: number): Promise<FeedPage> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError(`limit must be an integer in [1, 100], got ${limit}`);
    }
    const state = cursor === null ? this.initialState() : this.decode(cursor);

    await Promise.all(
      this.sources.map(async (src) => {
        const s = state[src.key];
        if (s.exhausted || s.buffer.length >= limit) return;
        const page = await src.fetchPage(viewerId, s.cursor, limit);
        s.buffer.push(...page.items);
        s.buffer.sort(compareFeedItems);
        s.cursor = page.nextCursor;
        s.exhausted = page.nextCursor === null;
      }),
    );

    const out: FeedItem[] = [];
    while (out.length < limit) {
      let pickKey: string | null = null;
      for (const src of this.sources) {
        const head = state[src.key].buffer[0];
        if (head === undefined) continue;
        if (pickKey === null || compareFeedItems(head, state[pickKey].buffer[0]) < 0) {
          pickKey = src.key;
        }
      }
      if (pickKey === null) break;
      out.push(state[pickKey].buffer.shift()!);
    }

    const done = this.sources.every((s) => state[s.key].exhausted && state[s.key].buffer.length === 0);
    return { items: out, nextCursor: done ? null : this.encode(state) };
  }

  private initialState(): MergedCursor {
    const st: MergedCursor = {};
    for (const s of this.sources) st[s.key] = { cursor: null, buffer: [], exhausted: false };
    return st;
  }

  private encode(state: MergedCursor): string {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  }

  private decode(cursor: string): MergedCursor {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch {
      throw new RangeError("malformed feed cursor");
    }
    const st = parsed as MergedCursor;
    for (const s of this.sources) {
      const entry = st?.[s.key];
      if (!entry || !Array.isArray(entry.buffer) || typeof entry.exhausted !== "boolean") {
        throw new RangeError("feed cursor does not match configured sources");
      }
    }
    return st;
  }
}
