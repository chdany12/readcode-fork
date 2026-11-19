import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime

log = logging.getLogger("scheduling.booking")

ELIGIBILITY_TIMEOUT_S = 3.0


class SlotTaken(Exception):
    pass


class NotEligible(Exception):
    pass


@dataclass(frozen=True)
class BookingRequest:
    patient_id: str
    provider_id: str
    start: datetime


class BookingService:
    def __init__(self, store, notifier, eligibility, max_parallel_checks=8):
        self._store = store
        self._notifier = notifier
        self._eligibility = eligibility
        self._provider_locks: dict[str, asyncio.Lock] = {}
        self._check_slots = asyncio.Semaphore(max_parallel_checks)
        self._background: set[asyncio.Task] = set()

    def _lock_for(self, provider_id: str) -> asyncio.Lock:
        lock = self._provider_locks.get(provider_id)
        if lock is None:
            lock = self._provider_locks[provider_id] = asyncio.Lock()
        return lock

    def _spawn(self, coro) -> None:
        task = asyncio.create_task(coro)
        self._background.add(task)
        task.add_done_callback(self._on_background_done)

    def _on_background_done(self, task: asyncio.Task) -> None:
        self._background.discard(task)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            log.warning("background task failed: %r", exc)

    async def book(self, req: BookingRequest):
        async with self._check_slots:
            eligible = await asyncio.wait_for(
                self._eligibility.check(req.patient_id, req.provider_id),
                timeout=ELIGIBILITY_TIMEOUT_S,
            )
        if not eligible:
            raise NotEligible(req.patient_id)

        async with self._lock_for(req.provider_id):
            if await self._store.is_taken(req.provider_id, req.start):
                raise SlotTaken(f"{req.provider_id} at {req.start.isoformat()}")
            appointment = await self._store.insert(req)

        self._spawn(self._notifier.send_confirmation(appointment))
        return appointment

    async def book_many(self, requests: list[BookingRequest]):
        results = await asyncio.gather(
            *(self.book(r) for r in requests), return_exceptions=True
        )
        booked, failed = [], []
        for req, result in zip(requests, results):
            if isinstance(result, BaseException):
                failed.append((req, result))
            else:
                booked.append(result)
        return booked, failed

    async def drain(self) -> None:
        if self._background:
            await asyncio.gather(*self._background, return_exceptions=True)
