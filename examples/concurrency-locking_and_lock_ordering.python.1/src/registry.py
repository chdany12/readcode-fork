import logging
import threading
from typing import Dict, List

from runner_pool import CapacityError, RunnerPool

log = logging.getLogger("ci.registry")


class PoolRegistry:
    def __init__(self) -> None:
        self._pools: Dict[str, RunnerPool] = {}
        self._guard = threading.Lock()

    def register(self, pool: RunnerPool) -> None:
        with self._guard:
            if pool.name in self._pools:
                raise ValueError(f"pool {pool.name} already registered")
            self._pools[pool.name] = pool

    def get(self, name: str) -> RunnerPool:
        with self._guard:
            return self._pools[name]

    def snapshot(self) -> List[RunnerPool]:
        with self._guard:
            return list(self._pools.values())

    def rebalance(self, src_name: str, dst_name: str, slots: int) -> None:
        if src_name == dst_name or slots <= 0:
            raise ValueError("invalid rebalance request")
        src = self.get(src_name)
        dst = self.get(dst_name)
        with src.lock:
            with dst.lock:
                if slots > src.available():
                    raise CapacityError(
                        f"{src.name} has only {src.available()} idle runners"
                    )
                src.capacity -= slots
                dst.capacity += slots
        log.info("moved %d runners %s -> %s", slots, src_name, dst_name)
