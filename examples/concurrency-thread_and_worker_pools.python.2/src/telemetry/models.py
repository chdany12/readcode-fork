import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Reading:
    device_id: str
    ts_ms: int
    metric: str
    value: float

    @classmethod
    def from_wire(cls, raw: bytes) -> "Reading":
        try:
            body = json.loads(raw)
            return cls(str(body["d"]), int(body["t"]), str(body["m"]), float(body["v"]))
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ValueError("malformed reading") from exc
