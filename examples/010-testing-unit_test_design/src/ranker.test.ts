import { Clock, IndexedDoc, Ranker, tokenize } from "./ranker";

const NOW = Date.UTC(2026, 0, 31);
const DAY = 24 * 60 * 60 * 1000;

class FixedClock implements Clock {
  constructor(private readonly t: number) {}
  now() { return this.t; }
}

function doc(overrides: Partial<IndexedDoc> & { id: string }): IndexedDoc {
  return { title: "", body: "", updatedAt: NOW, ...overrides };
}

describe("tokenize", () => {
  it("lowercases, splits on punctuation and drops single characters", () => {
    expect(tokenize("Re-Index a SHARD, v2!")).toEqual(["re", "index", "shard", "v2"]);
  });
});

describe("Ranker", () => {
  const ranker = new Ranker(new FixedClock(NOW));

  it("weights title matches above body matches", () => {
    const inTitle = doc({ id: "t", title: "shard rebalance" });
    const inBody = doc({ id: "b", body: "shard rebalance" });

    expect(ranker.score("shard", inTitle)).toBe(3);
    expect(ranker.score("shard", inBody)).toBe(1);
  });

  it("halves the score after one half-life", () => {
    const fresh = doc({ id: "f", body: "replica" });
    const old = doc({ id: "o", body: "replica", updatedAt: NOW - 30 * DAY });

    expect(ranker.score("replica", old)).toBeCloseTo(ranker.score("replica", fresh) / 2, 10);
  });

  it("does not boost documents dated in the future", () => {
    const future = doc({ id: "x", body: "replica", updatedAt: NOW + 5 * DAY });
    expect(ranker.score("replica", future)).toBe(1);
  });

  it("returns zero for queries with no usable terms", () => {
    expect(ranker.score("a ! ?", doc({ id: "z", body: "a b c" }))).toBe(0);
  });

  it("drops non-matching docs, orders by score, breaks ties by id, and applies the limit", () => {
    const docs = [
      doc({ id: "c", body: "merge" }),
      doc({ id: "a", body: "merge" }),
      doc({ id: "top", title: "merge" }),
      doc({ id: "miss", body: "unrelated" }),
    ];

    expect(ranker.rank("merge", docs, 3)).toEqual([
      { id: "top", score: 3 },
      { id: "a", score: 1 },
      { id: "c", score: 1 },
    ]);
    expect(ranker.rank("merge", docs, 1).map((h) => h.id)).toEqual(["top"]);
  });
});
