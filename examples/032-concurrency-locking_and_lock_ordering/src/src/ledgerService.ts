import { AccountLockTable } from "./accountLocks";

export interface Posting {
  accountId: string;
  amountCents: bigint;
  memo: string;
}

export interface LedgerStore {
  balance(accountId: string): Promise<bigint>;
  append(journalId: string, postings: Posting[]): Promise<void>;
  isOverdraftAllowed(accountId: string): Promise<boolean>;
}

export class UnbalancedJournalError extends Error {}
export class InsufficientFundsError extends Error {}

export class LedgerService {
  private readonly locks = new AccountLockTable();

  constructor(
    private readonly store: LedgerStore,
    private readonly feeAccountId: string,
    private readonly newJournalId: () => string,
  ) {}

  async post(postings: Posting[]): Promise<string> {
    const total = postings.reduce((sum, p) => sum + p.amountCents, 0n);
    if (postings.length < 2 || total !== 0n) {
      throw new UnbalancedJournalError(`journal does not balance: ${total}`);
    }

    const accountIds = postings.map((p) => p.accountId).sort();
    const held: string[] = [];
    try {
      for (const id of accountIds) {
        await this.locks.get(id).acquire();
        held.push(id);
      }

      const net = new Map<string, bigint>();
      for (const p of postings) net.set(p.accountId, (net.get(p.accountId) ?? 0n) + p.amountCents);

      for (const [accountId, delta] of net) {
        if (delta >= 0n) continue;
        const bal = await this.store.balance(accountId);
        if (bal + delta < 0n && !(await this.store.isOverdraftAllowed(accountId))) {
          throw new InsufficientFundsError(`account ${accountId} would go negative`);
        }
      }

      const journalId = this.newJournalId();
      await this.store.append(journalId, postings);
      return journalId;
    } finally {
      for (const id of held.reverse()) this.locks.get(id).release();
    }
  }

  async transfer(fromId: string, toId: string, amountCents: bigint, feeCents = 0n): Promise<string> {
    if (fromId === toId) throw new RangeError("cannot transfer to the same account");
    if (amountCents <= 0n || feeCents < 0n) throw new RangeError("invalid amount");

    const postings: Posting[] = [
      { accountId: fromId, amountCents: -amountCents, memo: "transfer out" },
      { accountId: toId, amountCents, memo: "transfer in" },
    ];
    if (feeCents > 0n) {
      postings.push(
        { accountId: fromId, amountCents: -feeCents, memo: "transfer fee" },
        { accountId: this.feeAccountId, amountCents: feeCents, memo: "fee income" },
      );
    }
    return this.post(postings);
  }
}
