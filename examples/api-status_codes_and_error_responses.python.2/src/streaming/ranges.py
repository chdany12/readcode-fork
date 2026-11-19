import re
from dataclasses import dataclass
from typing import Optional

_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")


class RangeNotSatisfiable(Exception):
    def __init__(self, size: int):
        super().__init__("range not satisfiable")
        self.size = size


@dataclass(frozen=True)
class ByteRange:
    start: int
    end: int


def parse_range(header: Optional[str], size: int) -> Optional[ByteRange]:
    if header is None:
        return None
    match = _RANGE.match(header.strip())
    if match is None:
        return None
    first, last = match.groups()
    if not first and not last:
        return None
    if not first:
        suffix = int(last)
        if suffix == 0 or size == 0:
            raise RangeNotSatisfiable(size)
        return ByteRange(max(size - suffix, 0), size - 1)
    start = int(first)
    end = int(last) if last else size - 1
    if end < start:
        return None
    if start >= size:
        raise RangeNotSatisfiable(size)
    return ByteRange(start, min(end, size - 1))
