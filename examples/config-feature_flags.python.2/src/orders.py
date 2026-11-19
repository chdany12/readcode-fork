import uuid
from dataclasses import dataclass

from flags import FlagClient
from inventory import Line, ReservationV1, ReservationV2


@dataclass
class Order:
    id: str
    customer_id: str
    lines: list[Line]
    reservation_version: int
    status: str = "pending"


class OrderService:
    def __init__(self, flags: FlagClient, v1: ReservationV1, v2: ReservationV2):
        self._flags = flags
        self._v1 = v1
        self._v2 = v2
        self._orders: dict[str, Order] = {}

    def _backend(self, version: int):
        return self._v2 if version == 2 else self._v1

    def create_order(self, customer_id: str, lines: list[Line]) -> Order:
        version = 2 if self._flags.is_enabled("reservation-v2", customer_id) else 1
        order = Order(str(uuid.uuid4()), customer_id, lines, version)
        self._backend(version).reserve(order.id, lines)
        self._orders[order.id] = order
        return order

    def confirm_order(self, order_id: str) -> Order:
        order = self._orders[order_id]
        if order.status != "pending":
            return order
        self._backend(order.reservation_version).commit(order.id)
        order.status = "confirmed"
        return order

    def cancel_order(self, order_id: str) -> Order:
        order = self._orders[order_id]
        if order.status == "cancelled":
            return order
        if self._flags.is_enabled("reservation-v2", order.customer_id):
            self._v2.release(order.id)
        else:
            self._v1.release(order.id)
        order.status = "cancelled"
        return order
