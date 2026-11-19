import json
import threading
from datetime import datetime

from book import AppointmentBook, SlotUnavailable


class BookingApi:
    def __init__(self, book: AppointmentBook):
        self.book = book
        self._replays = {}
        self._replay_lock = threading.Lock()

    def post_appointment(self, patient_id: str, headers: dict, body: dict):
        key = headers.get("Idempotency-Key")
        if key is None:
            return 400, {"error": "Idempotency-Key header is required"}

        replay_id = (patient_id, key)
        with self._replay_lock:
            cached = self._replays.get(replay_id)
        if cached is not None:
            return cached

        try:
            clinician_id = body["clinician_id"]
            starts_at = datetime.fromisoformat(body["starts_at"])
        except (KeyError, ValueError):
            return 422, {"error": "clinician_id and ISO starts_at are required"}

        try:
            appt = self.book.create(patient_id, clinician_id, starts_at)
            response = (201, appt)
        except SlotUnavailable as exc:
            response = (409, {"error": str(exc)})

        with self._replay_lock:
            self._replays.setdefault(replay_id, response)
            return self._replays[replay_id]
