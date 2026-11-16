export interface Account {
  id: string;
  balanceCents: bigint;
  overdraftLimitCents: bigint;
  frozen: boolean;
}

export interface LedgerEntry {
  accountId: string;
  amountCents: bigint;
  reference: string;
  postedAt: Date;
}

export interface LedgerTx {
  lockAccount(id: string): Promise<Account>;
  appendEntries(entries: LedgerEntry[]): Promise<void>;
  updateBalance(id: string, balanceCents: bigint): Promise<void>;
}

export interface LedgerRepository {
  withTransaction<T>(fn: (tx: LedgerTx) => Promise<T>): Promise<T>;
}
