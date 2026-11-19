from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

MIN_LEAD = timedelta(minutes=30)
MAX_LEAD = timedelta(hours=48)


class OrderItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    menu_item_id: str = Field(pattern=r"^[a-z0-9]{3,32}$")
    quantity: int = Field(ge=1, le=20, strict=True)


class PlaceOrder(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    restaurant_id: str = Field(pattern=r"^[a-z0-9-]{3,40}$")
    items: list[OrderItem] = Field(min_length=1, max_length=50)
    tip_cents: int = Field(default=0, ge=0, le=20_000, strict=True)
    promo_code: str | None = Field(default=None, pattern=r"^[A-Z0-9]{4,12}$")
    delivery_notes: str | None = Field(default=None, max_length=280)
    delivery_type: Literal["asap", "scheduled"] = "asap"
    scheduled_for: datetime | None = None

    @field_validator("delivery_notes")
    @classmethod
    def strip_control_chars(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = _CONTROL_CHARS.sub("", value)
        return cleaned or None

    @model_validator(mode="after")
    def check_schedule(self) -> "PlaceOrder":
        if self.delivery_type == "asap":
            if self.scheduled_for is not None:
                raise ValueError("scheduled_for is only allowed for scheduled delivery")
            return self
        if self.scheduled_for is None:
            raise ValueError("scheduled_for is required for scheduled delivery")
        if self.scheduled_for.tzinfo is None:
            raise ValueError("scheduled_for must include a UTC offset")
        lead = self.scheduled_for - datetime.now(timezone.utc)
        if not (MIN_LEAD <= lead <= MAX_LEAD):
            raise ValueError("scheduled_for must be between 30 minutes and 48 hours from now")
        return self
