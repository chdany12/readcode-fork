from datetime import timedelta
from enum import Enum

from pydantic import AwareDatetime, BaseModel, Field, model_validator


class Status(str, Enum):
    BOOKED = "booked"
    CANCELLED = "cancelled"


class AppointmentIn(BaseModel):
    patient_id: int
    practitioner_id: int
    starts_at: AwareDatetime
    duration_minutes: int = Field(ge=5, le=240)
    notes: str | None = Field(default=None, max_length=500)


class AppointmentPatch(BaseModel):
    starts_at: AwareDatetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=240)
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def reject_null_schedule(self) -> "AppointmentPatch":
        for name in ("starts_at", "duration_minutes"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class Appointment(AppointmentIn):
    id: int
    status: Status = Status.BOOKED

    @property
    def ends_at(self):
        return self.starts_at + timedelta(minutes=self.duration_minutes)
