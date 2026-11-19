import itertools
import threading
from datetime import datetime, timezone


class UnknownAccount(Exception):
    pass


class InsufficientFunds(Exception):
    pass


class KeyReuse(Exception):
    pass


class Ledger:
    def __init__(self, balances: dict[str, int]) -> None:
        self._lock = threading.Lock()
        self._balances = dict(balances)
        self._transfers: dict[int, dict] = {}
        self._by_key: dict[str, dict] = {}
        self._ids = itertools.count(1)

    def balance(self, account_id: str) -> int:
        with self._lock:
            return self._balances[account_id]

    def get_transfer(self, transfer_id: int) -> dict | None:
        with self._lock:
            return self._transfers.get(transfer_id)

    def post_transfer(
        self, key: str, source_id: str, destination_id: str, amount_cents: int
    ) -> tuple[dict, bool]:
        with self._lock:
            existing = self._by_key.get(key)
            if existing is not None:
                same = (
                    existing["source_id"] == source_id
                    and existing["destination_id"] == destination_id
                    and existing["amount_cents"] == amount_cents
                )
                if not same:
                    raise KeyReuse()
                return existing, True
            if source_id not in self._balances or destination_id not in self._balances:
                raise UnknownAccount()
            if self._balances[source_id] < amount_cents:
                raise InsufficientFunds()
            self._balances[source_id] -= amount_cents
            self._balances[destination_id] += amount_cents
            transfer = {
                "id": next(self._ids),
                "source_id": source_id,
                "destination_id": destination_id,
                "amount_cents": amount_cents,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._transfers[transfer["id"]] = transfer
            self._by_key[key] = transfer
            return transfer, False
