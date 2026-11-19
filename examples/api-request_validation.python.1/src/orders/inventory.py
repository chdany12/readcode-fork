from dataclasses import dataclass
from typing import Protocol


class InsufficientStock(Exception):
    def __init__(self, sku: str):
        super().__init__(sku)
        self.sku = sku


@dataclass(frozen=True)
class Reservation:
    id: str
    sku: str
    quantity: int


class Inventory(Protocol):
    def reserve(self, sku: str, quantity: int) -> Reservation: ...

    def release_all(self, reservations: list[Reservation]) -> None: ...
