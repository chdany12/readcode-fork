export type Currency = "USD" | "EUR" | "GBP";

export interface Posting {
  accountId: string;
  amountMinor: number; // positive = credit, negative = debit
  currency: Currency;
}

export interface JournalEntry {
  id: string;
  description: string;
  postings: Posting[];
  createdAt: Date;
}

export class UnbalancedEntryError extends Error {
  constructor(public readonly entryId: string, public readonly imbalance: number) {
    super(`journal entry ${entryId} is unbalanced by ${imbalance}`);
  }
}

export interface LedgerStore {
  append(entry: JournalEntry): Promise<void>;
  balanceOf(accountId: string, currency: Currency): Promise<number>;
}

export function assertBalanced(entry: JournalEntry): void {
  const byCurrency = new Map<Currency, number>();
  for (const p of entry.postings) {
    if (!Number.isSafeInteger(p.amountMinor)) {
      throw new Error(`posting amount must be integer minor units: ${p.amountMinor}`);
    }
    byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + p.amountMinor);
  }
  for (const [, sum] of byCurrency) {
    if (sum !== 0) throw new UnbalancedEntryError(entry.id, sum);
  }
}
