from datetime import datetime
from enum import Enum

from pydantic import AwareDatetime, BaseModel, Field


class ShipmentStatus(str, Enum):
    CREATED = "created"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    LOST = "lost"


class ShipmentIn(BaseModel):
    reference: str = Field(min_length=3, max_length=40)
    origin: str
    destination: str
    weight_grams: int = Field(gt=0, le=70_000_000)


class PickupWindowIn(BaseModel):
    window_start: AwareDatetime | None = None
    window_end: AwareDatetime


class TrackingEventIn(BaseModel):
    location: str
    description: str = Field(max_length=200)
    status: ShipmentStatus


class TrackingEvent(TrackingEventIn):
    at: datetime


class Shipment(ShipmentIn):
    id: int
    status: ShipmentStatus = ShipmentStatus.CREATED
    pickup_start: datetime | None = None
    pickup_end: datetime | None = None
    events: list[TrackingEvent] = Field(default_factory=list)
