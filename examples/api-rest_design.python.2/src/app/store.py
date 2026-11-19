import itertools
import threading

from .models import Appointment, AppointmentIn, Status


class SlotTaken(Exception):
    pass


class AppointmentStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ids = itertools.count(1)
        self._rows: dict[int, Appointment] = {}

    def _overlaps(self, candidate: Appointment) -> bool:
        for other in self._rows.values():
            if other.id == candidate.id or other.status is Status.CANCELLED:
                continue
            if other.practitioner_id != candidate.practitioner_id:
                continue
            if candidate.starts_at < other.ends_at and other.starts_at < candidate.ends_at:
                return True
        return False

    def insert(self, data: AppointmentIn) -> Appointment:
        with self._lock:
            appointment = Appointment(id=next(self._ids), **data.model_dump())
            if self._overlaps(appointment):
                raise SlotTaken()
            self._rows[appointment.id] = appointment
            return appointment

    def get(self, appointment_id: int) -> Appointment | None:
        with self._lock:
            return self._rows.get(appointment_id)

    def update(self, appointment_id: int, changes: dict) -> Appointment | None:
        with self._lock:
            current = self._rows.get(appointment_id)
            if current is None:
                return None
            candidate = current.model_copy(update=changes)
            if current.status is Status.BOOKED and self._overlaps(candidate):
                raise SlotTaken()
            self._rows[appointment_id] = candidate
            return candidate

    def cancel(self, appointment_id: int) -> bool:
        with self._lock:
            current = self._rows.get(appointment_id)
            if current is None:
                return False
            self._rows[appointment_id] = current.model_copy(update={"status": Status.CANCELLED})
            return True

    def list_for(self, practitioner_id: int, limit: int, offset: int) -> list[Appointment]:
        with self._lock:
            rows = [a for a in self._rows.values() if a.practitioner_id == practitioner_id]
        rows.sort(key=lambda a: (a.starts_at, a.id))
        return rows[offset : offset + limit]
