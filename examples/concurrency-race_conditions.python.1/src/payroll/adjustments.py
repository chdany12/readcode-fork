import threading
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List


class PeriodClosedError(Exception):
    pass


@dataclass(frozen=True)
class Adjustment:
    employee_id: str
    kind: str  # "bonus", "reimbursement" or "deduction"
    amount: Decimal
    memo: str


def _net(items: List[Adjustment]) -> Decimal:
    total = Decimal("0")
    for adj in items:
        total += -adj.amount if adj.kind == "deduction" else adj.amount
    return total


class AdjustmentLedger:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending: Dict[str, List[Adjustment]] = defaultdict(list)
        self._closed = False

    def add(self, adj: Adjustment) -> None:
        if adj.amount <= 0:
            raise ValueError("amount must be positive")
        with self._lock:
            if self._closed:
                raise PeriodClosedError("pay period already closed")
            self._pending[adj.employee_id].append(adj)

    def pending_count(self) -> int:
        with self._lock:
            return sum(len(v) for v in self._pending.values())

    def preview(self) -> Dict[str, Decimal]:
        totals: Dict[str, Decimal] = {}
        for employee_id, items in self._pending.items():
            totals[employee_id] = _net(items)
        return totals

    def close_period(self) -> Dict[str, Decimal]:
        with self._lock:
            if self._closed:
                raise PeriodClosedError("pay period already closed")
            self._closed = True
            pending, self._pending = self._pending, defaultdict(list)
        return {employee_id: _net(items) for employee_id, items in pending.items()}
