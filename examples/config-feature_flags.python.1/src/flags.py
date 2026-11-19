import hashlib
import logging
import threading
import time
from typing import Callable, Mapping

log = logging.getLogger("billing.flags")

DEFAULTS = {
    "route-via-processor-b": False,
    "block-new-card-bins": True,
    "retry-failed-captures": False,
}


class FlagsUnavailable(Exception):
    pass


class FlagCache:
    def __init__(
        self,
        fetch: Callable[..., Mapping[str, dict]],
        ttl: float = 30.0,
        max_stale: float = 300.0,
        retry_backoff: float = 5.0,
        timeout: float = 1.5,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._fetch = fetch
        self._ttl = ttl
        self._max_stale = max_stale
        self._retry_backoff = retry_backoff
        self._timeout = timeout
        self._clock = clock
        self._lock = threading.Lock()
        self._flags: Mapping[str, dict] | None = None
        self._loaded_at = 0.0
        self._retry_after = 0.0

    def snapshot(self) -> Mapping[str, dict]:
        with self._lock:
            now = self._clock()
            if self._flags is not None and now - self._loaded_at < self._ttl:
                return self._flags
            if now < self._retry_after:
                return self._stale_or_raise(now, None)
            try:
                flags = self._fetch(timeout=self._timeout)
            except Exception as exc:
                self._retry_after = now + self._retry_backoff
                return self._stale_or_raise(now, exc)
            self._flags = flags
            self._loaded_at = now
            return flags

    def _stale_or_raise(self, now: float, cause: Exception | None) -> Mapping[str, dict]:
        if self._flags is not None and now - self._loaded_at <= self._max_stale:
            log.warning("serving stale flags (age=%.0fs)", now - self._loaded_at)
            return self._flags
        raise FlagsUnavailable("no usable flag snapshot") from cause


class Flags:
    def __init__(self, cache: FlagCache):
        self._cache = cache

    def is_enabled(self, key: str, merchant_id: str) -> bool:
        default = DEFAULTS.get(key, False)
        try:
            flags = self._cache.snapshot()
        except FlagsUnavailable:
            return default
        spec = flags.get(key)
        if spec is None:
            return default
        if not spec.get("enabled", False):
            return False
        pct = int(spec.get("percent", 100))
        if pct >= 100:
            return True
        digest = hashlib.sha256(f"{key}:{merchant_id}".encode()).digest()
        return int.from_bytes(digest[:4], "big") % 100 < pct
