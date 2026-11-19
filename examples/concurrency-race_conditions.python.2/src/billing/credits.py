import threading
from typing import Dict


class _Account:
    __slots__ = ("lock", "balance_cents", "applied")

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.balance_cents = 0
        self.applied: Dict[str, int] = {}


class CreditLedger:
    def __init__(self) -> None:
        self._accounts: Dict[str, _Account] = {}
        self._accounts_guard = threading.Lock()

    def _account(self, customer_id: str) -> _Account:
        with self._accounts_guard:
            acct = self._accounts.get(customer_id)
            if acct is None:
                acct = _Account()
                self._accounts[customer_id] = acct
            return acct

    def grant(self, customer_id: str, cents: int) -> int:
        if cents <= 0:
            raise ValueError("grant must be positive")
        acct = self._account(customer_id)
        with acct.lock:
            acct.balance_cents += cents
            return acct.balance_cents

    def balance(self, customer_id: str) -> int:
        acct = self._account(customer_id)
        with acct.lock:
            return acct.balance_cents

    def apply_to_invoice(self, customer_id: str, invoice_id: str, total_cents: int) -> int:
        acct = self._account(customer_id)
        with acct.lock:
            prior = acct.applied.get(invoice_id)
            if prior is not None:
                return prior
            used = min(acct.balance_cents, total_cents)
            acct.balance_cents -= used
            acct.applied[invoice_id] = used
            return used

    def reverse(self, customer_id: str, invoice_id: str) -> int:
        acct = self._account(customer_id)
        with acct.lock:
            used = acct.applied.pop(invoice_id, 0)
            acct.balance_cents += used
            return used
