import json
from datetime import timezone
from decimal import Decimal

from orders.schema import BadRequest, parse_new_order

CENT = Decimal("0.01")


def _encode(value):
    if isinstance(value, Decimal):
        return format(value, "f")
    raise TypeError("cannot serialize " + type(value).__name__)


def order_view(order_id: str, order, placed_at) -> dict:
    subtotal = sum((i.unit_price * i.qty for i in order.items), Decimal("0.00"))
    total = (subtotal + order.tip).quantize(CENT)
    return {
        "order_id": order_id,
        "status": "received",
        "placed_at": placed_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": [
            {"item_id": i.item_id, "qty": i.qty, "unit_price": i.unit_price}
            for i in order.items
        ],
        "subtotal": subtotal.quantize(CENT),
        "tip": order.tip,
        "total": total,
    }


def create_order(raw: bytes, clock, ids, repo):
    try:
        order = parse_new_order(raw)
    except BadRequest as exc:
        return 400, json.dumps({"error": exc.code})
    order_id = ids.next()
    placed_at = clock.now()
    repo.save(order_id, order, placed_at)
    body = json.dumps(order_view(order_id, order, placed_at), default=_encode, sort_keys=True)
    return 201, body
