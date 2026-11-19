import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

CENT = Decimal("0.01")
MAX_MONEY = Decimal("1000")
MAX_ITEMS = 40


class BadRequest(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Item:
    item_id: str
    qty: int
    unit_price: Decimal


@dataclass(frozen=True)
class NewOrder:
    customer_id: str
    items: tuple
    tip: Decimal
    notes: str


def _reject_constant(name):
    raise ValueError("unsupported constant " + name)


def load_body(raw: bytes) -> dict:
    try:
        data = json.loads(raw, parse_float=Decimal, parse_constant=_reject_constant)
    except (ValueError, RecursionError):
        raise BadRequest("invalid_json")
    if not isinstance(data, dict):
        raise BadRequest("expected_object")
    return data


def parse_money(value, field: str) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (int, str, Decimal)):
        raise BadRequest(field + "_invalid")
    try:
        amount = Decimal(value)
    except InvalidOperation:
        raise BadRequest(field + "_invalid")
    if not amount.is_finite() or amount < 0 or amount > MAX_MONEY:
        raise BadRequest(field + "_out_of_range")
    if amount != amount.quantize(CENT):
        raise BadRequest(field + "_too_precise")
    return amount.quantize(CENT)


def parse_new_order(raw: bytes) -> NewOrder:
    data = load_body(raw)

    customer_id = data.get("customer_id")
    if not isinstance(customer_id, str) or not customer_id.strip():
        raise BadRequest("customer_id_required")

    raw_items = data.get("items")
    if not isinstance(raw_items, list) or not 1 <= len(raw_items) <= MAX_ITEMS:
        raise BadRequest("items_invalid")

    items = []
    for entry in raw_items:
        if not isinstance(entry, dict):
            raise BadRequest("item_invalid")
        item_id = entry.get("item_id")
        qty = entry.get("qty")
        if not isinstance(item_id, str) or not item_id:
            raise BadRequest("item_id_required")
        if isinstance(qty, bool) or not isinstance(qty, int) or not 1 <= qty <= 50:
            raise BadRequest("qty_invalid")
        items.append(Item(item_id, qty, parse_money(entry.get("unit_price"), "unit_price")))

    tip = parse_money(data["tip"], "tip") if "tip" in data else Decimal("0.00")

    notes = data.get("notes", "")
    if not isinstance(notes, str) or len(notes) > 280:
        raise BadRequest("notes_invalid")

    return NewOrder(customer_id.strip(), tuple(items), tip, notes)
