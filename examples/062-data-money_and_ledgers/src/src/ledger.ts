export type AccountId = string;

export interface Posting {
  account: AccountId;
  amountCents: number;
}

export interface JournalEntry {
  id: string;
  memo: string;
  postings: Posting[];
  createdAt: Date;
}

export interface LedgerStore {
  appendEntry(entry: JournalEntry, idempotencyKey: string): Promise<boolean>;
}

export class Ledger {
  constructor(private readonly store: LedgerStore) {}

  async post(entry: JournalEntry, idempotencyKey: string): Promise<boolean> {
    if (entry.postings.length < 2) throw new Error("entry needs at least two postings");
    for (const p of entry.postings) {
      if (!Number.isInteger(p.amountCents)) throw new Error(`non-integer amount on ${p.account}`);
    }
    const sum = entry.postings.reduce((s, p) => s + p.amountCents, 0);
    if (sum !== 0) throw new Error(`unbalanced entry ${entry.id}: off by ${sum}`);
    return this.store.appendEntry(entry, idempotencyKey);
  }
}
