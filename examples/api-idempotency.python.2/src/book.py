import threading
import uuid
from datetime import datetime


class SlotUnavailable(Exception):
    pass


class AppointmentBook:
    def __init__(self):
        self._lock = threading.Lock()
        self._by_slot = {}
        self._by_id = {}

    def create(self, patient_id: str, clinician_id: str, starts_at: datetime) -> dict:
        with self._lock:
            slot = (clinician_id, starts_at)
            if slot in self._by_slot:
                raise SlotUnavailable(f"{clinician_id} is booked at {starts_at.isoformat()}")
            appt = {
                "id": str(uuid.uuid4()),
                "patient_id": patient_id,
                "clinician_id": clinician_id,
                "starts_at": starts_at.isoformat(),
            }
            self._by_slot[slot] = appt["id"]
            self._by_id[appt["id"]] = appt
            return appt
