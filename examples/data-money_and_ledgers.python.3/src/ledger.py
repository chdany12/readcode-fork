import sqlite3
from dataclasses import dataclass


class LedgerImbalance(Exception):
    pass


@dataclass(frozen=True)
class Entry:
    account: str
    debit_cents: int = 0
    credit_cents: int = 0


class Ledger:
    """Double-entry ledger. The caller owns the transaction: post() never commits."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def exists(self, ref: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM ledger_txn WHERE ref = ?", (ref,)
        ).fetchone()
        return row is not None

    def post(self, ref: str, entries: list[Entry], currency: str = "USD") -> None:
        if not entries:
            raise ValueError("a transaction needs at least one entry")
        for e in entries:
            if e.debit_cents < 0 or e.credit_cents < 0:
                raise ValueError("negative amount")
            if e.debit_cents and e.credit_cents:
                raise ValueError("entry has both sides")
        debits = sum(e.debit_cents for e in entries)
        credits = sum(e.credit_cents for e in entries)
        if debits != credits:
            raise LedgerImbalance(f"{ref}: debits {debits} != credits {credits}")
        self._conn.execute(
            "INSERT INTO ledger_txn (ref, currency) VALUES (?, ?)", (ref, currency)
        )
        self._conn.executemany(
            "INSERT INTO ledger_entry (txn_ref, account, debit_cents, credit_cents)"
            " VALUES (?, ?, ?, ?)",
            [(ref, e.account, e.debit_cents, e.credit_cents) for e in entries],
        )
