import logging
from dataclasses import dataclass

from flags import FlagEvaluator

log = logging.getLogger("dispatch")


@dataclass(frozen=True)
class RideRequest:
    request_id: str
    rider_id: str
    city: str
    lat: float
    lon: float


@dataclass(frozen=True)
class Driver:
    driver_id: str
    lat: float
    lon: float
    acceptance_rate: float


def distance_km(a_lat, a_lon, b_lat, b_lon) -> float:
    return ((a_lat - b_lat) ** 2 + (a_lon - b_lon) ** 2) ** 0.5 * 111.0


class Dispatcher:
    def __init__(self, flags: FlagEvaluator, max_radius_km: float = 8.0):
        self._flags = flags
        self._max_radius_km = max_radius_km

    def pick_driver(self, req: RideRequest, drivers: list[Driver]) -> Driver | None:
        nearby = [
            d for d in drivers
            if distance_km(req.lat, req.lon, d.lat, d.lon) <= self._max_radius_km
        ]
        if not nearby:
            return None
        if self._flags.is_on("match-by-acceptance", req.rider_id, req.city):
            ranked = sorted(
                nearby,
                key=lambda d: distance_km(req.lat, req.lon, d.lat, d.lon) * (2.0 - d.acceptance_rate),
            )
        else:
            ranked = sorted(nearby, key=lambda d: distance_km(req.lat, req.lon, d.lat, d.lon))
        chosen = ranked[0]
        log.info("dispatch %s -> %s", req.request_id, chosen.driver_id)
        return chosen
