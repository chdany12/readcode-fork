from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

VEHICLE_CLASSES = {"standard", "xl", "accessible"}
MAX_SCHEDULE_AHEAD = timedelta(days=7)


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _check_point(body: dict, key: str, errors: dict[str, str]) -> tuple[float, float] | None:
    point = body.get(key)
    if not isinstance(point, dict):
        errors[key] = "must be an object with lat and lon"
        return None
    lat, lon = point.get("lat"), point.get("lon")
    if not (_is_number(lat) and _is_number(lon)):
        errors[key] = "lat and lon must be numbers"
        return None
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        errors[key] = "lat/lon out of range"
        return None
    return float(lat), float(lon)


def validate_ride_request(body: object, now: datetime) -> tuple[dict | None, dict[str, str]]:
    errors: dict[str, str] = {}
    if not isinstance(body, dict):
        return None, {"body": "must be a JSON object"}

    pickup = _check_point(body, "pickup", errors)
    dropoff = _check_point(body, "dropoff", errors)

    seats = body.get("seats", 1)
    if not (isinstance(seats, int) and not isinstance(seats, bool) and 1 <= seats <= 6):
        errors["seats"] = "must be an integer between 1 and 6"

    vehicle_class = body.get("vehicle_class", "standard")
    if vehicle_class not in VEHICLE_CLASSES:
        errors["vehicle_class"] = "unknown vehicle class"

    scheduled_at = None
    raw_time = body.get("scheduled_at")
    if raw_time is not None:
        try:
            scheduled_at = datetime.fromisoformat(raw_time)
        except (TypeError, ValueError):
            errors["scheduled_at"] = "must be an ISO 8601 timestamp"
        else:
            if scheduled_at.tzinfo is None:
                errors["scheduled_at"] = "must include a UTC offset"
            elif not (now <= scheduled_at.astimezone(timezone.utc) <= now + MAX_SCHEDULE_AHEAD):
                errors["scheduled_at"] = "must be within the next 7 days"

    if errors:
        return None, errors
    return {
        "pickup": pickup,
        "dropoff": dropoff,
        "seats": seats,
        "vehicle_class": vehicle_class,
        "scheduled_at": scheduled_at,
    }, {}
