import random
import time

MAX_ELAPSED_SECONDS = 6 * 60 * 60


def submit_with_retries(send, customer_id: str, idem_key: str, payload: dict):
    started = time.monotonic()
    delay = 2.0
    while True:
        try:
            return send(customer_id, idem_key, **payload)
        except TimeoutError:
            if time.monotonic() - started > MAX_ELAPSED_SECONDS:
                raise
            time.sleep(delay + random.random())
            delay = min(delay * 2, 600.0)
