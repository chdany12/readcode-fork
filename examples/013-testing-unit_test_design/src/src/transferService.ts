import { LedgerRepository, Account, LedgerEntry } from "./ledgerRepository";

export class InsufficientFundsError extends Error {
  constructor(public readonly accountId: string, public readonly shortfallCents: bigint) {
    super(`account ${accountId} is short by ${shortfallCents} cents`);
    this.name = "InsufficientFundsError";
  }
}

export class AccountFrozenError extends Error {
  constructor(public readonly accountId: string) {
    super(`account ${accountId} is frozen`);
    this.name = "AccountFrozenError";
  }
}

export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amountCents: bigint;
  reference: string;
}

export class TransferService {
  constructor(private readonly repo: LedgerRepository, private readonly clock: () => Date) {}

  async transfer(req: TransferRequest): Promise<LedgerEntry[]> {
    if (req.amountCents <= 0n) {
      throw new RangeError("amount must be positive");
    }
    if (req.fromAccountId === req.toAccountId) {
      throw new RangeError("cannot transfer to the same account");
    }

    return this.repo.withTransaction(async (tx) => {
      const from: Account = await tx.lockAccount(req.fromAccountId);
      const to: Account = await tx.lockAccount(req.toAccountId);

      if (from.frozen) throw new AccountFrozenError(from.id);
      if (to.frozen) throw new AccountFrozenError(to.id);

      const available = from.balanceCents + from.overdraftLimitCents;
      if (available < req.amountCents) {
        throw new InsufficientFundsError(from.id, req.amountCents - available);
      }

      const postedAt = this.clock();
      const entries: LedgerEntry[] = [
        { accountId: from.id, amountCents: -req.amountCents, reference: req.reference, postedAt },
        { accountId: to.id, amountCents: req.amountCents, reference: req.reference, postedAt },
      ];
      await tx.appendEntries(entries);
      await tx.updateBalance(from.id, from.balanceCents - req.amountCents);
      await tx.updateBalance(to.id, to.balanceCents + req.amountCents);
      return entries;
    });
  }
}
