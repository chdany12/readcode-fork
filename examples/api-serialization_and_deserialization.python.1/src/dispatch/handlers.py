import logging

from dispatch.codec import RequestError, dumps, parse_ride_request
from dispatch.models import Trip

log = logging.getLogger("dispatch.handlers")


class TripHandlers:
    def __init__(self, dispatcher, trips):
        self._dispatcher = dispatcher
        self._trips = trips

    def request_ride(self, raw_body: bytes):
        try:
            request = parse_ride_request(raw_body)
        except RequestError as exc:
            return 400, dumps({"error": str(exc)})

        trip: Trip = self._dispatcher.assign(request)
        if trip.fare_estimate is not None and request.fare_cap is not None:
            if trip.fare_estimate > request.fare_cap:
                log.info("fare estimate above cap for rider %s", request.rider_id)
                return 409, dumps({"error": "fare_above_cap", "estimate": trip.fare_estimate})
        return 201, dumps(trip)

    def get_trip(self, trip_id: str, viewer_id: str):
        trip = self._trips.find(trip_id)
        if trip is None or trip.rider_id != viewer_id:
            return 404, dumps({"error": "not_found"})
        return 200, dumps(trip)
