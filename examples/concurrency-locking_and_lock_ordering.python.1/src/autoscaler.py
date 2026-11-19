import logging
from typing import Dict, Optional

from registry import PoolRegistry
from runner_pool import CapacityError

log = logging.getLogger("ci.autoscaler")


class Autoscaler:
    """One instance per CI region; all instances share the same registry."""

    def __init__(self, registry: PoolRegistry, low_water: int = 2) -> None:
        self._registry = registry
        self._low_water = low_water

    def tick(self, queue_depths: Dict[str, int]) -> None:
        for name, waiting in queue_depths.items():
            if waiting == 0:
                continue
            pool = self._registry.get(name)
            if pool.available() >= self._low_water:
                continue
            donor = self._pick_donor(exclude=name)
            if donor is None:
                log.warning("no donor for %s (%d jobs waiting)", name, waiting)
                continue
            try:
                self._registry.rebalance(donor, name, self._low_water)
            except CapacityError as exc:
                log.info("donor %s could not spare runners: %s", donor, exc)

    def _pick_donor(self, exclude: str) -> Optional[str]:
        best, best_idle = None, self._low_water
        for pool in self._registry.snapshot():
            if pool.name == exclude:
                continue
            if pool.available() > best_idle:
                best, best_idle = pool.name, pool.available()
        return best
