import hashlib
from typing import Iterable


class FlagClient:
    def __init__(self, rules: dict[str, dict] | None = None):
        self._rules = rules or {}

    def replace(self, rules: dict[str, dict]) -> None:
        self._rules = dict(rules)

    def is_enabled(self, key: str, subject: str) -> bool:
        rule = self._rules.get(key)
        if rule is None or not rule.get("enabled", False):
            return False
        pct = rule.get("percent", 100)
        if pct >= 100:
            return True
        digest = hashlib.md5(f"{key}:{subject}".encode()).hexdigest()
        return int(digest, 16) % 100 < pct


def enabled_keys(client: FlagClient, keys: Iterable[str], subject: str) -> list[str]:
    return [k for k in keys if client.is_enabled(k, subject)]
