import json
import logging

logger = logging.getLogger("billing.plan_cache")

TTL_SECONDS = 600


class BillingSettingsCache:
    def __init__(self, redis_client, repo, transactions):
        self._redis = redis_client
        self._repo = repo
        self._transactions = transactions

    def _version_key(self, customer_id: str) -> str:
        return f"billing:settings:ver:{customer_id}"

    def _data_key(self, customer_id: str, version: int) -> str:
        return f"billing:settings:{customer_id}:v{version}"

    def _current_version(self, customer_id: str) -> int:
        raw = self._redis.get(self._version_key(customer_id))
        return int(raw) if raw is not None else 0

    def get(self, customer_id: str) -> dict:
        version = self._current_version(customer_id)
        key = self._data_key(customer_id, version)
        cached = self._redis.get(key)
        if cached is not None:
            return json.loads(cached)

        settings = self._repo.load_settings(customer_id)
        self._redis.set(key, json.dumps(settings), ex=TTL_SECONDS)
        return settings

    def update(self, customer_id: str, changes: dict) -> dict:
        with self._transactions.begin() as tx:
            current = self._repo.load_settings(customer_id, tx=tx, for_update=True)
            updated = {**current, **changes}
            self._repo.save_settings(customer_id, updated, tx=tx)

        self._invalidate(customer_id)
        return updated

    def _invalidate(self, customer_id: str) -> None:
        try:
            self._redis.incr(self._version_key(customer_id))
        except Exception:
            logger.warning(
                "could not bump settings version for %s; entries expire in %ss",
                customer_id,
                TTL_SECONDS,
                exc_info=True,
            )
