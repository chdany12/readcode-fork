from fastapi import FastAPI, HTTPException, Query, Response

from .models import Appointment, AppointmentIn, AppointmentPatch
from .store import AppointmentStore, SlotTaken

app = FastAPI(title="scheduling")
store = AppointmentStore()


def _conflict() -> HTTPException:
    return HTTPException(status_code=409, detail="practitioner already booked in that time range")


@app.post("/v1/appointments", response_model=Appointment, status_code=201)
def book(body: AppointmentIn, response: Response) -> Appointment:
    try:
        appointment = store.insert(body)
    except SlotTaken:
        raise _conflict()
    response.headers["Location"] = f"/v1/appointments/{appointment.id}"
    return appointment


@app.get("/v1/appointments/{appointment_id}", response_model=Appointment)
def read(appointment_id: int) -> Appointment:
    appointment = store.get(appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="appointment not found")
    return appointment


@app.get("/v1/practitioners/{practitioner_id}/appointments", response_model=list[Appointment])
def schedule(
    practitioner_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[Appointment]:
    return store.list_for(practitioner_id, limit, offset)


@app.patch("/v1/appointments/{appointment_id}", response_model=Appointment)
def reschedule(appointment_id: int, body: AppointmentPatch) -> Appointment:
    changes = body.model_dump(exclude_unset=True)
    try:
        updated = store.update(appointment_id, changes)
    except SlotTaken:
        raise _conflict()
    if updated is None:
        raise HTTPException(status_code=404, detail="appointment not found")
    return updated


@app.delete("/v1/appointments/{appointment_id}", status_code=204)
def cancel(appointment_id: int) -> Response:
    if not store.cancel(appointment_id):
        raise HTTPException(status_code=404, detail="appointment not found")
    return Response(status_code=204)
