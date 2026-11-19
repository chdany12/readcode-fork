import itertools
from dataclasses import dataclass


class InsufficientStock(Exception):
    pass


@dataclass(frozen=True)
class Line:
    sku: str
    qty: int


class ReservationV1:
    def __init__(self, stock: dict[str, int]):
        self._stock = stock
        self._reserved: dict[str, list[Line]] = {}

    def reserve(self, order_id: str, lines: list[Line]) -> None:
        for line in lines:
            if self._stock.get(line.sku, 0) < line.qty:
                raise InsufficientStock(line.sku)
        for line in lines:
            self._stock[line.sku] -= line.qty
        self._reserved[order_id] = list(lines)

    def release(self, order_id: str) -> None:
        for line in self._reserved.pop(order_id, []):
            self._stock[line.sku] += line.qty

    def commit(self, order_id: str) -> None:
        self._reserved.pop(order_id, None)


class ReservationV2:
    _ids = itertools.count(1)

    def __init__(self, available: dict[str, int]):
        self._available = available
        self._holds: dict[int, tuple[str, Line]] = {}
        self._by_order: dict[str, list[int]] = {}

    def reserve(self, order_id: str, lines: list[Line]) -> None:
        taken: list[int] = []
        try:
            for line in lines:
                if self._available.get(line.sku, 0) < line.qty:
                    raise InsufficientStock(line.sku)
                self._available[line.sku] -= line.qty
                hold_id = next(self._ids)
                self._holds[hold_id] = (order_id, line)
                taken.append(hold_id)
        except InsufficientStock:
            self._drop(taken)
            raise
        self._by_order[order_id] = taken

    def release(self, order_id: str) -> None:
        self._drop(self._by_order.pop(order_id, []))

    def commit(self, order_id: str) -> None:
        for hold_id in self._by_order.pop(order_id, []):
            self._holds.pop(hold_id, None)

    def _drop(self, hold_ids: list[int]) -> None:
        for hold_id in hold_ids:
            _, line = self._holds.pop(hold_id)
            self._available[line.sku] += line.qty
