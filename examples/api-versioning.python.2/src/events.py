from typing import Any, Dict

CURRENT_VERSION = 3

REQUIRED_FIELDS = {
    1: ("campaign", "cost", "ts"),
    2: ("campaign_id", "cost_micros", "ts"),
    3: ("campaign_id", "cost_micros", "ts", "currency"),
}


class InvalidEvent(Exception):
    pass


def _v1_to_v2(event: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(event)
    out["campaign_id"] = out.pop("campaign")
    out["cost_micros"] = round(out.pop("cost") * 1_000_000)
    out["schema_version"] = 2
    return out


def _v2_to_v3(event: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(event)
    out.setdefault("currency", "USD")
    out["schema_version"] = 3
    return out


UPGRADERS = {1: _v1_to_v2, 2: _v2_to_v3}


def validate(event: Dict[str, Any]) -> int:
    version = event.get("schema_version", 1)
    if not isinstance(version, int) or version < 1:
        raise InvalidEvent(f"bad schema_version: {version!r}")
    required = REQUIRED_FIELDS.get(version, ())
    missing = [name for name in required if name not in event]
    if missing:
        raise InvalidEvent(f"v{version} event missing {', '.join(missing)}")
    return version


def upgrade(event: Dict[str, Any]) -> Dict[str, Any]:
    version = validate(event)
    while version < CURRENT_VERSION:
        event = UPGRADERS[version](event)
        version = event["schema_version"]
    return event
