from typing import Optional

SUPPORTED_VERSIONS = (1, 2, 3)
DEPRECATED_VERSIONS = {1: "Mon, 30 Jun 2025 00:00:00 GMT"}


class UnsupportedVersion(Exception):
    def __init__(self, raw: str):
        super().__init__(f"unsupported API version: {raw!r}")
        self.raw = raw


def parse_version(raw: Optional[str]) -> Optional[int]:
    if raw is None:
        return None
    cleaned = raw.strip().lstrip("vV")
    if cleaned == "":
        return None
    if not cleaned.isdigit():
        raise UnsupportedVersion(raw)
    version = int(cleaned)
    if version not in SUPPORTED_VERSIONS:
        raise UnsupportedVersion(raw)
    return version
