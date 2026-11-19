from datetime import datetime, timezone

from flask import Flask, jsonify, request

from .geo import haversine_km
from .validation import validate_ride_request

MAX_TRIP_KM = 150.0
BASE_FARE_CENTS = 300
PER_KM_CENTS = 120


def create_app(dispatcher) -> Flask:
    app = Flask(__name__)

    @app.post("/v1/rides")
    def request_ride():
        now = datetime.now(timezone.utc)
        ride, errors = validate_ride_request(request.get_json(silent=True), now)
        if errors:
            return jsonify(error="invalid request", fields=errors), 400

        distance_km = haversine_km(ride["pickup"], ride["dropoff"])
        if distance_km > MAX_TRIP_KM:
            return jsonify(error="trip too long", max_km=MAX_TRIP_KM), 422

        fare_cents = BASE_FARE_CENTS + round(distance_km * PER_KM_CENTS)
        ride_id = dispatcher.enqueue(
            rider_id=request.headers["X-Rider-Id"],
            pickup=ride["pickup"],
            dropoff=ride["dropoff"],
            seats=ride["seats"],
            vehicle_class=ride["vehicle_class"],
            scheduled_at=ride["scheduled_at"],
            quoted_fare_cents=fare_cents,
        )
        return jsonify(ride_id=ride_id, quoted_fare_cents=fare_cents), 202

    return app
