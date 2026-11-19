import logging
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from telemetry.models import Reading

log = logging.getLogger("telemetry.ingest")


class TelemetryIngestor:
    def __init__(self, source, store, metrics, workers: int = 4, batch_size: int = 200):
        self._source = source
        self._store = store
        self._metrics = metrics
        self._batch_size = batch_size
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="telemetry-writer")
        self._inflight = threading.BoundedSemaphore(workers * 2)
        self._stop = threading.Event()

    def run(self) -> None:
        while not self._stop.is_set():
            batch = self._source.poll(self._batch_size, timeout=1.0)
            if batch is None:
                continue
            readings = [r for r in map(self._parse, batch.messages) if r is not None]
            self._inflight.acquire()
            future = self._pool.submit(self._write_batch, readings)
            future.add_done_callback(lambda _f: self._inflight.release())
            self._source.ack(batch.token)

    def stop(self) -> None:
        self._stop.set()

    def close(self) -> None:
        self.stop()
        self._pool.shutdown(wait=True)

    def _parse(self, message: bytes) -> Optional[Reading]:
        try:
            return Reading.from_wire(message)
        except ValueError:
            self._metrics.increment("telemetry.malformed")
            return None

    def _write_batch(self, readings: List[Reading]) -> None:
        if not readings:
            return
        per_device = Counter(r.device_id for r in readings)
        self._store.insert_many(readings)
        self._metrics.increment("telemetry.stored", len(readings))
        log.debug("stored %d readings from %d devices", len(readings), len(per_device))
