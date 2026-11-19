import { Pool, PoolClient } from "pg";
import { BalanceCache } from "./balanceCache";

export class InsufficientFundsError extends Error {
  constructor(public readonly accountId: string) {
    super(`insufficient funds in ${accountId}`);
  }
}

export interface Balance {
  accountId: string;
  availableCents: number;
  version: number;
}

export class LedgerService {
  constructor(private readonly db: Pool, private readonly cache: BalanceCache) {}

  async getBalance(accountId: string): Promise<Balance | null> {
    const cached = await this.cache.get(accountId);
    if (cached) return cached;

    const { rows } = await this.db.query(
      "SELECT account_id, available_cents, version FROM accounts WHERE account_id = $1",
      [accountId],
    );
    if (rows.length === 0) return null;
    const balance: Balance = {
      accountId: rows[0].account_id,
      availableCents: Number(rows[0].available_cents),
      version: Number(rows[0].version),
    };
    await this.cache.set(balance);
    return balance;
  }

  async transfer(fromId: string, toId: string, amountCents: number, reference: string): Promise<void> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new RangeError("amount must be a positive integer number of cents");
    }
    const [first, second] = [fromId, toId].sort();
    const client: PoolClient = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT account_id FROM accounts WHERE account_id IN ($1, $2) ORDER BY account_id FOR UPDATE",
        [first, second],
      );
      const debit = await client.query(
        `UPDATE accounts SET available_cents = available_cents - $2, version = version + 1
         WHERE account_id = $1 AND available_cents >= $2 RETURNING version`,
        [fromId, amountCents],
      );
      if (debit.rowCount === 0) throw new InsufficientFundsError(fromId);
      await client.query(
        "UPDATE accounts SET available_cents = available_cents + $2, version = version + 1 WHERE account_id = $1",
        [toId, amountCents],
      );
      await client.query(
        "INSERT INTO ledger_entries (reference, debit_account, credit_account, amount_cents) VALUES ($1, $2, $3, $4)",
        [reference, fromId, toId, amountCents],
      );
      await this.cache.invalidate(fromId, toId);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
