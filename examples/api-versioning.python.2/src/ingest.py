from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

from events import InvalidEvent, upgrade


@dataclass
class IngestResult:
    accepted: List[Dict[str, Any]] = field(default_factory=list)
    rejected: List[Tuple[Dict[str, Any], str]] = field(default_factory=list)


def normalize_batch(raw_events: List[Dict[str, Any]]) -> IngestResult:
    result = IngestResult()
    for raw in raw_events:
        try:
            result.accepted.append(upgrade(raw))
        except InvalidEvent as exc:
            result.rejected.append((raw, str(exc)))
    return result


def spend_by_campaign(events: List[Dict[str, Any]]) -> Dict[Tuple[str, str], int]:
    totals: Dict[Tuple[str, str], int] = defaultdict(int)
    for event in events:
        key = (event["campaign_id"], event["currency"])
        totals[key] += event["cost_micros"]
    return dict(totals)


def ingest_batch(raw_events: List[Dict[str, Any]], sink) -> IngestResult:
    result = normalize_batch(raw_events)
    totals = spend_by_campaign(result.accepted)
    sink.add_spend(totals)
    if result.rejected:
        sink.record_rejections(result.rejected)
    return result
