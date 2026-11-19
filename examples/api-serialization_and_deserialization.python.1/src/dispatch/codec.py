import dataclasses
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum

from dispatch.models import GeoPoint, RideRequest


class RequestError(ValueError):
    pass


class DispatchEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            if o.tzinfo is None:
                raise TypeError("naive datetime cannot be serialized")
            return o.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if isinstance(o, Decimal):
            return str(o)
        if isinstance(o, Enum):
            return o.value
        if dataclasses.is_dataclass(o) and not isinstance(o, type):
            return dataclasses.asdict(o)
        return super().default(o)


def dumps(obj) -> bytes:
    return json.dumps(obj, cls=DispatchEncoder, separators=(",", ":")).encode("utf-8")


def _point(raw, field: str) -> GeoPoint:
    if not isinstance(raw, dict):
        raise RequestError(f"{field} must be an object")
    try:
        lat = float(raw["lat"])
        lng = float(raw["lng"])
    except (KeyError, TypeError, ValueError):
        raise RequestError(f"{field} needs numeric lat and lng")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise RequestError(f"{field} is out of range")
    return GeoPoint(lat, lng)


def parse_ride_request(raw: bytes) -> RideRequest:
    try:
        payload = json.loads(raw)
    except ValueError:
        raise RequestError("body is not valid JSON")
    if not isinstance(payload, dict):
        raise RequestError("body must be an object")

    rider_id = payload.get("rider_id")
    if not isinstance(rider_id, str) or not rider_id:
        raise RequestError("rider_id is required")

    seats = payload.get("seats", 1)
    if isinstance(seats, bool) or not isinstance(seats, int) or not 1 <= seats <= 6:
        raise RequestError("seats must be an integer between 1 and 6")

    requested_raw = payload.get("requested_at")
    if not isinstance(requested_raw, str):
        raise RequestError("requested_at is required")
    try:
        requested_at = datetime.fromisoformat(requested_raw.replace("Z", "+00:00"))
    except ValueError:
        raise RequestError("requested_at must be ISO-8601")
    if requested_at.tzinfo is None:
        raise RequestError("requested_at must include a UTC offset")

    fare_cap = None
    if payload.get("fare_cap") is not None:
        try:
            fare_cap = Decimal(str(payload["fare_cap"]))
        except InvalidOperation:
            raise RequestError("fare_cap must be a decimal")
        if not fare_cap.is_finite() or fare_cap <= 0:
            raise RequestError("fare_cap must be positive")

    return RideRequest(
        rider_id=rider_id,
        pickup=_point(payload.get("pickup"), "pickup"),
        dropoff=_point(payload.get("dropoff"), "dropoff"),
        seats=seats,
        requested_at=requested_at,
        fare_cap=fare_cap,
    )
