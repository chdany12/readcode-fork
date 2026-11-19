import json

from idempotency import IdempotencyStore, KeyConflict, KeyInProgress, StoredResult, fingerprint


class ImpressionIngest:
    def __init__(self, store: IdempotencyStore, writer):
        self.store = store
        self.writer = writer

    def record_batch(self, account: str, key: str, payload: dict) -> tuple[int, str]:
        if not key:
            return 400, json.dumps({"error": "Idempotency-Key required"})
        events = payload.get("events")
        if not isinstance(events, list) or not events:
            return 422, json.dumps({"error": "events must be a non-empty list"})

        try:
            prior = self.store.begin(account, key, fingerprint(payload))
        except KeyConflict:
            return 422, json.dumps({"error": "key reused with different payload"})
        except KeyInProgress:
            return 409, json.dumps({"error": "request in progress"})
        if prior is not None:
            return prior.status, prior.body

        try:
            accepted = self.writer.write_events(account, events)
        except Exception:
            self.store.abandon(account, key)
            raise

        body = json.dumps({"accepted": accepted})
        self.store.finish(account, key, StoredResult(status=202, body=body))
        return 202, body
