import { LedgerAuditRecord, GENESIS_HASH, computeHash } from "./hashChain";

export interface AuditRepository {
  lastRecord(): Promise<LedgerAuditRecord | null>;
  append(record: LedgerAuditRecord): Promise<void>;
}

type AuditInput = {
  operatorId: string;
  operation: LedgerAuditRecord["operation"];
  accountId: string;
  amountCents: number;
  currency: string;
};

export class BillingAuditWriter {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly repo: AuditRepository, private readonly clock: () => Date = () => new Date()) {}

  record(entry: AuditInput): Promise<LedgerAuditRecord> {
    const run = this.tail.then(() => this.appendNext(entry));
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async appendNext(entry: AuditInput): Promise<LedgerAuditRecord> {
    if (!Number.isInteger(entry.amountCents) || entry.amountCents < 0) {
      throw new Error(`invalid amount ${entry.amountCents}`);
    }
    const last = await this.repo.lastRecord();
    const base = {
      index: last ? last.index + 1 : 0,
      recordedAt: this.clock().toISOString(),
      operatorId: entry.operatorId,
      operation: entry.operation,
      accountId: entry.accountId,
      amountCents: entry.amountCents,
      currency: entry.currency.toUpperCase(),
      prevHash: last ? last.hash : GENESIS_HASH,
    };
    const record: LedgerAuditRecord = { ...base, hash: computeHash(base) };
    await this.repo.append(record);
    return record;
  }
}
