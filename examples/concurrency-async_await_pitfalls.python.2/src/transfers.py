import asyncio
import logging
from collections import defaultdict
from decimal import Decimal

log = logging.getLogger("payments.transfers")

REVIEW_THRESHOLD = 0.85
FRAUD_TIMEOUT_S = 2.0
BATCH_CONCURRENCY = 5


class InsufficientFunds(Exception):
    pass


class TransferHeld(Exception):
    pass


class TransferService:
    def __init__(self, ledger, fraud, audit):
        self._ledger = ledger
        self._fraud = fraud
        self._audit = audit
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._pending_audits: set[asyncio.Task] = set()

    async def transfer(self, src: str, dst: str, amount: Decimal, key: str):
        if amount <= 0:
            raise ValueError("amount must be positive")

        risk = await asyncio.wait_for(
            self._fraud.score(src, dst, amount), timeout=FRAUD_TIMEOUT_S
        )
        if risk >= REVIEW_THRESHOLD:
            raise TransferHeld(key)

        available = await self._ledger.available_balance(src)
        if available < amount:
            raise InsufficientFunds(src)

        async with self._locks[src]:
            entry_ids = await self._ledger.post_entries(
                [
                    {"account": src, "side": "debit", "amount": str(amount)},
                    {"account": dst, "side": "credit", "amount": str(amount)},
                ],
                idempotency_key=key,
            )

        self._track(self._audit.record("transfer", src, dst, amount, entry_ids))
        return entry_ids

    def _track(self, coro) -> None:
        task = asyncio.create_task(coro)
        self._pending_audits.add(task)
        task.add_done_callback(self._pending_audits.discard)

    async def transfer_batch(self, items: list[tuple[str, str, Decimal, str]]):
        gate = asyncio.Semaphore(BATCH_CONCURRENCY)

        async def run_one(item):
            async with gate:
                return await self.transfer(*item)

        return await asyncio.gather(
            *(run_one(i) for i in items), return_exceptions=True
        )

    async def flush_audits(self) -> None:
        pending = list(self._pending_audits)
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
