import logging

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from .inventory import InsufficientStock, Inventory
from .schemas import OrderIn

log = logging.getLogger("orders")
bp = Blueprint("orders", __name__, url_prefix="/v1/orders")

MAX_BODY_BYTES = 32 * 1024


def make_view(inventory: Inventory):
    @bp.post("")
    def create_order():
        if request.content_length is not None and request.content_length > MAX_BODY_BYTES:
            return jsonify(error="payload too large"), 413

        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify(error="body must be a JSON object"), 400

        try:
            order = OrderIn.model_validate(body)
        except ValidationError as exc:
            problems = exc.errors(include_url=False, include_context=False, include_input=False)
            return jsonify(error="invalid order", problems=problems), 422

        reserved = []
        try:
            for line in order.lines:
                log.info("reserving sku=%s qty=%d for %s", line.sku, line.quantity, order.customer_ref)
                reserved.append(inventory.reserve(line.sku, line.quantity))
        except InsufficientStock as exc:
            inventory.release_all(reserved)
            return jsonify(error="insufficient stock", sku=exc.sku), 409

        return jsonify(reservations=[r.id for r in reserved]), 201

    return bp
