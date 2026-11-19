import time
import zlib
from collections import deque

from runtime import Profile

MAX_BUFFERED = 5000
ALARM_TEMP_C = 85.0


def is_sampled(device_id: str, rate: float) -> bool:
    if rate >= 1.0:
        return True
    bucket = zlib.crc32(device_id.encode("utf-8")) % 10_000
    return bucket < int(rate * 10_000)


class TelemetryIngest:
    def __init__(self, profile: Profile, sink, clock=time.monotonic):
        self._profile = profile
        self._sink = sink
        self._clock = clock
        self._buffer = deque(maxlen=MAX_BUFFERED)
        self._last_flush = clock()
        self.dropped = 0

    def ingest(self, reading: dict) -> None:
        alarm = reading.get("temp_c", 0.0) >= ALARM_TEMP_C
        if not alarm and not is_sampled(reading["device_id"], self._profile.sample_rate):
            return

        if len(self._buffer) == self._buffer.maxlen:
            self.dropped += 1
        self._buffer.append(reading)

        due = self._clock() - self._last_flush >= self._profile.flush_interval_s
        if len(self._buffer) >= self._profile.batch_size or due:
            self.flush()

    def flush(self) -> None:
        if not self._buffer:
            return
        batch = list(self._buffer)[: self._profile.batch_size]
        self._sink(batch)
        for _ in batch:
            self._buffer.popleft()
        self._last_flush = self._clock()

    def close(self) -> None:
        while self._buffer:
            self.flush()
