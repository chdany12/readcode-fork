import { TransferService, InsufficientFundsError, AccountFrozenError } from "./transferService";
import { Account, LedgerEntry, LedgerRepository, LedgerTx } from "./ledgerRepository";

class InMemoryLedger implements LedgerRepository {
  accounts = new Map<string, Account>();
  entries: LedgerEntry[] = [];

  async withTransaction<T>(fn: (tx: LedgerTx) => Promise<T>): Promise<T> {
    const snapshot = new Map([...this.accounts].map(([k, v]) => [k, { ...v }]));
    const pending: LedgerEntry[] = [];
    const tx: LedgerTx = {
      lockAccount: async (id) => {
        const acct = snapshot.get(id);
        if (!acct) throw new Error(`unknown account ${id}`);
        return { ...acct };
      },
      appendEntries: async (e) => { pending.push(...e); },
      updateBalance: async (id, bal) => { snapshot.get(id)!.balanceCents = bal; },
    };
    const result = await fn(tx);
    this.accounts = snapshot;
    this.entries.push(...pending);
    return result;
  }
}

const FIXED_NOW = new Date("2024-03-01T12:00:00Z");

function account(id: string, balance: bigint, extra: Partial<Account> = {}): Account {
  return { id, balanceCents: balance, overdraftLimitCents: 0n, frozen: false, ...extra };
}

describe("TransferService", () => {
  let ledger: InMemoryLedger;
  let service: TransferService;

  beforeEach(() => {
    ledger = new InMemoryLedger();
    ledger.accounts.set("acc-a", account("acc-a", 10_000n));
    ledger.accounts.set("acc-b", account("acc-b", 500n));
    service = new TransferService(ledger, () => FIXED_NOW);
  });

  it("posts balanced entries and moves the balance", async () => {
    const entries = await service.transfer({
      fromAccountId: "acc-a", toAccountId: "acc-b", amountCents: 2_500n, reference: "inv-1",
    });
    expect(entries.reduce((s, e) => s + e.amountCents, 0n)).toBe(0n);
    expect(ledger.accounts.get("acc-a")!.balanceCents).toBe(7_500n);
    expect(ledger.accounts.get("acc-b")!.balanceCents).toBe(3_000n);
    expect(ledger.entries.every((e) => e.postedAt === FIXED_NOW)).toBe(true);
  });

  it("allows spending into the overdraft limit", async () => {
    ledger.accounts.set("acc-b", account("acc-b", 500n, { overdraftLimitCents: 1_000n }));
    await service.transfer({
      fromAccountId: "acc-b", toAccountId: "acc-a", amountCents: 1_500n, reference: "od-1",
    });
    expect(ledger.accounts.get("acc-b")!.balanceCents).toBe(-1_000n);
  });

  it("rejects transfers beyond available funds and leaves balances untouched", async () => {
    expect(
      service.transfer({ fromAccountId: "acc-b", toAccountId: "acc-a", amountCents: 501n, reference: "x" }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(ledger.accounts.get("acc-b")!.balanceCents).toBe(500n);
    expect(ledger.entries).toHaveLength(0);
  });

  it("refuses to debit a frozen account", async () => {
    ledger.accounts.set("acc-a", account("acc-a", 10_000n, { frozen: true }));
    await expect(
      service.transfer({ fromAccountId: "acc-a", toAccountId: "acc-b", amountCents: 1n, reference: "f" }),
    ).rejects.toBeInstanceOf(AccountFrozenError);
  });

  it.each([0n, -100n])("rejects non-positive amount %s", async (amount) => {
    await expect(
      service.transfer({ fromAccountId: "acc-a", toAccountId: "acc-b", amountCents: amount, reference: "z" }),
    ).rejects.toThrow(RangeError);
  });
});
