import json
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Rule:
    key: str
    enabled: bool
    percent: int = 100
    cities: frozenset[str] = field(default_factory=frozenset)
    kill: bool = False


def load_rules(raw: str) -> dict[str, Rule]:
    rules: dict[str, Rule] = {}
    for item in json.loads(raw):
        percent = int(item.get("percent", 100))
        if not 0 <= percent <= 100:
            raise ValueError(f"bad percent for {item['key']}: {percent}")
        rules[item["key"]] = Rule(
            key=item["key"],
            enabled=bool(item.get("enabled", False)),
            percent=percent,
            cities=frozenset(item.get("cities", [])),
            kill=bool(item.get("kill", False)),
        )
    return rules


class FlagEvaluator:
    def __init__(self, rules: dict[str, Rule]):
        self._rules = rules

    def swap(self, rules: dict[str, Rule]) -> None:
        self._rules = rules

    def is_on(self, key: str, rider_id: str, city: str) -> bool:
        rule = self._rules.get(key)
        if rule is None or rule.kill or not rule.enabled:
            return False
        if rule.cities and city not in rule.cities:
            return False
        if rule.percent >= 100:
            return True
        return hash(f"{key}:{rider_id}") % 100 < rule.percent
