import threading
import time
from datetime import timedelta
from decimal import Decimal

from ledger import InsufficientFunds, Ledger

DEDUPE_WINDOW = timedelta(minutes=5)


class TransferService:
    def __init__(self, ledger: Ledger, clock=time.time):
        self.ledger = ledger
        self.clock = clock
        self._seen = {}
        self._lock = threading.Lock()

    def submit(self, customer_id: str, idem_key: str, src: str, dst: str, amount: str):
        with self._lock:
            now = self.clock()
            self._evict(now)

            cache_key = (customer_id, idem_key)
            hit = self._seen.get(cache_key)
            if hit is not None:
                return hit["result"]

            try:
                value = Decimal(amount)
            except ArithmeticError:
                return {"status": "rejected", "reason": "bad amount"}
            if value <= 0:
                return {"status": "rejected", "reason": "amount must be positive"}

            try:
                entry_id = self.ledger.transfer(src, dst, value)
                result = {"status": "completed", "entry_id": entry_id}
            except InsufficientFunds:
                result = {"status": "rejected", "reason": "insufficient funds"}

            self._seen[cache_key] = {"result": result, "at": now}
            return result

    def _evict(self, now: float) -> None:
        cutoff = now - DEDUPE_WINDOW.total_seconds()
        for k in [k for k, v in self._seen.items() if v["at"] < cutoff]:
            del self._seen[k]
