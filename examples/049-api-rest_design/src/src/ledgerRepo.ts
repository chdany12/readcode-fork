export interface LedgerEntry {
  id: string;
  accountId: string;
  postedAt: Date;
  amountMinor: bigint;
  description: string;
}

export interface Statement {
  id: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  openingBalanceMinor: bigint;
  closingBalanceMinor: bigint;
  entryCount: number;
  createdAt: Date;
}

export interface LedgerRepo {
  findAccount(accountId: string, ownerId: string): Promise<{ id: string; currency: string } | null>;
  balanceAt(accountId: string, at: Date): Promise<bigint>;
  entriesBetween(accountId: string, from: Date, to: Date): Promise<LedgerEntry[]>;
  lastStatement(accountId: string): Promise<Statement | null>;
  insertStatement(s: Statement): Promise<void>;
  getStatement(accountId: string, statementId: string): Promise<Statement | null>;
}
