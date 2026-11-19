import { KeyedMutex } from "./keyedMutex";

export interface Account {
  id: string;
  currency: string;
  balanceMinor: bigint;
  frozen: boolean;
}

export interface LedgerStore {
  getAccount(id: string): Promise<Account | undefined>;
  applyTransfer(entry: {
    transferId: string;
    debitId: string;
    creditId: string;
    amountMinor: bigint;
    debitBalanceAfter: bigint;
    creditBalanceAfter: bigint;
  }): Promise<void>;
}

export class TransferError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export class TransferService {
  private readonly locks = new KeyedMutex();

  constructor(private readonly store: LedgerStore) {}

  async transfer(transferId: string, fromId: string, toId: string, amountMinor: bigint): Promise<void> {
    if (fromId === toId) {
      throw new TransferError("SAME_ACCOUNT", "cannot transfer to the same account");
    }
    if (amountMinor <= 0n) {
      throw new TransferError("INVALID_AMOUNT", "amount must be positive");
    }

    const [firstId, secondId] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const releaseFirst = await this.locks.acquire(firstId);
    try {
      const releaseSecond = await this.locks.acquire(secondId);
      try {
        const from = await this.store.getAccount(fromId);
        const to = await this.store.getAccount(toId);
        if (!from || !to) {
          throw new TransferError("NOT_FOUND", "account not found");
        }
        if (from.frozen || to.frozen) {
          throw new TransferError("FROZEN", "account is frozen");
        }
        if (from.currency !== to.currency) {
          throw new TransferError("CURRENCY_MISMATCH", "cross-currency transfers are not supported");
        }
        if (from.balanceMinor < amountMinor) {
          throw new TransferError("INSUFFICIENT_FUNDS", "insufficient funds");
        }

        await this.store.applyTransfer({
          transferId,
          debitId: fromId,
          creditId: toId,
          amountMinor,
          debitBalanceAfter: from.balanceMinor - amountMinor,
          creditBalanceAfter: to.balanceMinor + amountMinor,
        });
      } finally {
        releaseSecond();
      }
    } finally {
      releaseFirst();
    }
  }
}
