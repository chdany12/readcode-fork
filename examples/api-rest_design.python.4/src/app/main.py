import itertools
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Query, Response

from .models import (
    PickupWindowIn,
    Shipment,
    ShipmentIn,
    ShipmentStatus,
    TrackingEvent,
    TrackingEventIn,
)

app = FastAPI(title="shipments")
router = APIRouter(prefix="/v1/shipments")

_lock = threading.Lock()
_ids = itertools.count(1)
_shipments: dict[int, Shipment] = {}


def _find(shipment_id: int) -> Shipment:
    shipment = _shipments.get(shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="shipment not found")
    return shipment


@router.post("", response_model=Shipment, status_code=201)
def create_shipment(body: ShipmentIn, response: Response) -> Shipment:
    with _lock:
        if any(s.reference == body.reference for s in _shipments.values()):
            raise HTTPException(status_code=409, detail="reference already used")
        shipment = Shipment(id=next(_ids), **body.model_dump())
        _shipments[shipment.id] = shipment
    response.headers["Location"] = f"/v1/shipments/{shipment.id}"
    return shipment


@router.get("", response_model=list[Shipment])
def list_shipments(
    status: ShipmentStatus | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[Shipment]:
    with _lock:
        rows = [s for s in _shipments.values() if status is None or s.status == status]
    rows.sort(key=lambda s: s.id)
    return rows[offset : offset + limit]


@router.get("/{shipment_id}", response_model=Shipment)
def get_shipment(shipment_id: int) -> Shipment:
    with _lock:
        return _find(shipment_id)


@router.put("/{shipment_id}/pickup-window", response_model=Shipment)
def set_pickup_window(shipment_id: int, body: PickupWindowIn) -> Shipment:
    window_start = body.window_start or datetime.now(timezone.utc)
    if body.window_end <= window_start:
        raise HTTPException(status_code=422, detail="window_end must be after window_start")
    with _lock:
        shipment = _find(shipment_id)
        if shipment.status is not ShipmentStatus.CREATED:
            raise HTTPException(status_code=409, detail="pickup window is locked once in transit")
        shipment.pickup_start = window_start
        shipment.pickup_end = body.window_end
        return shipment


@router.post("/{shipment_id}/events", response_model=TrackingEvent, status_code=201)
def add_event(shipment_id: int, body: TrackingEventIn) -> TrackingEvent:
    with _lock:
        shipment = _find(shipment_id)
        if shipment.status in (ShipmentStatus.DELIVERED, ShipmentStatus.LOST):
            raise HTTPException(status_code=409, detail="shipment is closed")
        event = TrackingEvent(**body.model_dump(), at=datetime.now(timezone.utc))
        shipment.events.append(event)
        shipment.status = body.status
        return event


app.include_router(router)
