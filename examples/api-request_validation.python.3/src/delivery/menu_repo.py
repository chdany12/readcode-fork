from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Restaurant:
    id: str
    is_open: bool
    minimum_order_cents: int


class MenuRepo(Protocol):
    def get_restaurant(self, restaurant_id: str) -> Restaurant | None: ...

    def prices_for(self, restaurant_id: str, item_ids: list[str]) -> dict[str, int]: ...

    def create_order(self, order: dict, subtotal_cents: int) -> str: ...
