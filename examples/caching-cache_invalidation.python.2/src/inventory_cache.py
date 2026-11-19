import logging
from typing import Optional, Protocol

logger = logging.getLogger(__name__)


class KeyValueClient(Protocol):
    def get(self, key: str) -> Optional[bytes]: ...

    def setex(self, key: str, ttl_seconds: int, value: bytes) -> None: ...

    def delete(self, *keys: str) -> int: ...


class StockCache:
    KEY_PREFIX = "stock:v1"

    def __init__(self, client: KeyValueClient, ttl_seconds: int = 300):
        self._client = client
        self._ttl_seconds = ttl_seconds

    def _key(self, sku: str, warehouse_id: str) -> str:
        return f"{self.KEY_PREFIX}:{warehouse_id}:{sku}"

    def get(self, sku: str, warehouse_id: str) -> Optional[dict]:
        try:
            raw = self._client.get(self._key(sku, warehouse_id))
        except ConnectionError:
            logger.warning("stock cache unavailable on get", extra={"sku": sku})
            return None
        if raw is None:
            return None
        import json

        return json.loads(raw)

    def put(self, sku: str, warehouse_id: str, snapshot: dict) -> None:
        import json

        try:
            self._client.setex(
                self._key(sku, warehouse_id),
                self._ttl_seconds,
                json.dumps(snapshot).encode("utf-8"),
            )
        except ConnectionError:
            logger.warning("stock cache unavailable on put", extra={"sku": sku})

    def invalidate(self, sku: str, warehouse_id: str) -> None:
        self._client.delete(self._key(sku, warehouse_id))
