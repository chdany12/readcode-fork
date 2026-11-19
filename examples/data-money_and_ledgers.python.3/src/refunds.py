import sqlite3
from dataclasses import dataclass

from ledger import Entry, Ledger
from money import allocate


class RefundExceedsCaptured(Exception):
    pass


@dataclass(frozen=True)
class Line:
    sku: str
    total_cents: int


class RefundService:
    def __init__(self, conn: sqlite3.Connection, ledger: Ledger, gateway):
        self._conn = conn
        self._ledger = ledger
        self._gateway = gateway

    def _load_lines(self, order_id: str) -> list[Line]:
        rows = self._conn.execute(
            "SELECT sku, qty * unit_cents FROM order_line WHERE order_id = ? ORDER BY id",
            (order_id,),
        ).fetchall()
        return [Line(sku, total) for sku, total in rows]

    def refund_order(self, order_id: str, amount_cents: int, request_id: str) -> str:
        if amount_cents <= 0:
            raise ValueError("refund amount must be positive")
        ref = f"refund:{order_id}:{request_id}"
        if self._ledger.exists(ref):
            return ref

        charge_id, captured, refunded = self._conn.execute(
            "SELECT charge_id, captured_cents, refunded_cents FROM orders WHERE id = ?",
            (order_id,),
        ).fetchone()
        if refunded + amount_cents > captured:
            raise RefundExceedsCaptured(order_id)

        lines = self._load_lines(order_id)
        shares = allocate(amount_cents, [l.total_cents for l in lines])

        self._gateway.refund(charge_id, amount_cents, idempotency_key=ref)

        entries = [
            Entry(f"revenue:{l.sku}", debit_cents=share)
            for l, share in zip(lines, shares)
            if share
        ]
        entries.append(Entry("cash_clearing", credit_cents=sum(shares)))

        with self._conn:
            cur = self._conn.execute(
                "UPDATE orders SET refunded_cents = refunded_cents + ?"
                " WHERE id = ? AND refunded_cents + ? <= captured_cents",
                (amount_cents, order_id, amount_cents),
            )
            if cur.rowcount != 1:
                raise RefundExceedsCaptured(order_id)
            self._ledger.post(ref, entries)
        return ref
