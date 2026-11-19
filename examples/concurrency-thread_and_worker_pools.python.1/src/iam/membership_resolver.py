import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, Iterable

from directory_client import DirectoryClient

log = logging.getLogger("iam.membership")


@dataclass
class Resolution:
    groups: Dict[str, FrozenSet[str]] = field(default_factory=dict)
    failures: Dict[str, str] = field(default_factory=dict)


class MembershipResolver:
    def __init__(self, directory: DirectoryClient, max_workers: int = 8, deadline_s: float = 3.0):
        self._directory = directory
        self._deadline_s = deadline_s
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="iam-dir")

    def resolve_many(self, principal_ids: Iterable[str]) -> Resolution:
        unique_ids = list(dict.fromkeys(principal_ids))
        futures = {
            self._executor.submit(self._directory.groups_for, pid): pid
            for pid in unique_ids
        }
        resolution = Resolution()
        try:
            for future in as_completed(futures, timeout=self._deadline_s):
                pid = futures[future]
                try:
                    resolution.groups[pid] = future.result()
                except Exception as exc:
                    log.warning("membership lookup failed for %s: %s", pid, exc)
                    resolution.failures[pid] = type(exc).__name__
        except FutureTimeout:
            for future, pid in futures.items():
                if not future.done():
                    future.cancel()
                    resolution.failures[pid] = "deadline exceeded"
        return resolution

    def close(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)
