import logging
import urllib.request

from config import Settings, load_config

log = logging.getLogger("dispatch")


class CarrierClient:
    def __init__(self, settings: Settings):
        self._base_url = settings.carrier.base_url.rstrip("/")
        self._timeout = settings.carrier.timeout_s
        self._retries = settings.carrier.max_retries

    def book_pickup(self, route_id: str) -> bytes:
        url = f"{self._base_url}/pickups/{route_id}"
        last_exc = None
        for attempt in range(self._retries + 1):
            try:
                with urllib.request.urlopen(url, timeout=self._timeout) as resp:
                    return resp.read()
            except OSError as exc:
                last_exc = exc
                log.warning("pickup %s attempt %d failed: %s", route_id, attempt, exc)
        raise RuntimeError(f"carrier unavailable for route {route_id}") from last_exc


def plan_route(settings: Settings, stops: list[str]) -> list[list[str]]:
    size = settings.routing.max_stops_per_route
    ordered = sorted(stops) if settings.routing.optimize else list(stops)
    return [ordered[i:i + size] for i in range(0, len(ordered), size)]


def main():
    settings = load_config()
    log.info("starting %s on port %d", settings.name, settings.port)
    client = CarrierClient(settings)
    return client, settings
