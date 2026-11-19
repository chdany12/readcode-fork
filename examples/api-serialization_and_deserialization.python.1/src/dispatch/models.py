from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional


class TripState(Enum):
    REQUESTED = "requested"
    MATCHED = "matched"
    EN_ROUTE = "en_route"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class GeoPoint:
    lat: float
    lng: float


@dataclass
class Driver:
    driver_id: str
    display_name: str
    vehicle_plate: str
    rating: Decimal
    phone: str
    payout_account: str


@dataclass
class RideRequest:
    rider_id: str
    pickup: GeoPoint
    dropoff: GeoPoint
    seats: int
    requested_at: datetime
    fare_cap: Optional[Decimal]


@dataclass
class Trip:
    trip_id: str
    rider_id: str
    state: TripState
    pickup: GeoPoint
    dropoff: GeoPoint
    requested_at: datetime
    fare_estimate: Decimal
    driver: Optional[Driver] = None
