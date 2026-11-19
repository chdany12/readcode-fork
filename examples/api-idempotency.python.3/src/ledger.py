import threading
import uuid
from decimal import Decimal


class InsufficientFunds(Exception):
    pass


class Ledger:
    def __init__(self, balances: dict):
        self._balances = {k: Decimal(v) for k, v in balances.items()}
        self._entries = []
        self._lock = threading.Lock()

    def transfer(self, src: str, dst: str, amount: Decimal) -> str:
        with self._lock:
            if self._balances[src] < amount:
                raise InsufficientFunds(src)
            self._balances[src] -= amount
            self._balances[dst] += amount
            entry_id = str(uuid.uuid4())
            self._entries.append((entry_id, src, dst, amount))
            return entry_id

    def balance(self, account: str) -> Decimal:
        with self._lock:
            return self._balances[account]
