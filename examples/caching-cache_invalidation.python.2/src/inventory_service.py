from dataclasses import dataclass
from typing import List

from inventory_cache import StockCache


class StockNotFound(Exception):
    pass


class InsufficientStock(Exception):
    pass


@dataclass(frozen=True)
class OrderLine:
    sku: str
    warehouse_id: str
    quantity: int


@dataclass(frozen=True)
class ReceivedItem:
    sku: str
    warehouse_id: str
    quantity: int


class InventoryService:
    def __init__(self, db, cache: StockCache):
        self._db = db
        self._cache = cache

    def get_stock(self, sku: str, warehouse_id: str) -> dict:
        cached = self._cache.get(sku, warehouse_id)
        if cached is not None:
            return cached

        row = self._db.fetch_one(
            "SELECT sku, warehouse_id, on_hand, reserved, version "
            "FROM stock WHERE sku = %s AND warehouse_id = %s",
            (sku, warehouse_id),
        )
        if row is None:
            raise StockNotFound(f"{sku}@{warehouse_id}")

        snapshot = {
            "sku": row["sku"],
            "warehouse_id": row["warehouse_id"],
            "available": row["on_hand"] - row["reserved"],
            "version": row["version"],
        }
        self._cache.put(sku, warehouse_id, snapshot)
        return snapshot

    def reserve(self, order_id: str, lines: List[OrderLine]) -> None:
        with self._db.transaction() as tx:
            for line in lines:
                updated = tx.execute(
                    "UPDATE stock SET reserved = reserved + %s, version = version + 1 "
                    "WHERE sku = %s AND warehouse_id = %s "
                    "AND on_hand - reserved >= %s",
                    (line.quantity, line.sku, line.warehouse_id, line.quantity),
                )
                if updated == 0:
                    raise InsufficientStock(line.sku)
                self._cache.invalidate(line.sku, line.warehouse_id)
                tx.execute(
                    "INSERT INTO reservations (order_id, sku, warehouse_id, quantity) "
                    "VALUES (%s, %s, %s, %s)",
                    (order_id, line.sku, line.warehouse_id, line.quantity),
                )

    def release(self, order_id: str) -> None:
        with self._db.transaction() as tx:
            rows = tx.fetch_all(
                "DELETE FROM reservations WHERE order_id = %s "
                "RETURNING sku, warehouse_id, quantity",
                (order_id,),
            )
            for row in rows:
                tx.execute(
                    "UPDATE stock SET reserved = reserved - %s, version = version + 1 "
                    "WHERE sku = %s AND warehouse_id = %s",
                    (row["quantity"], row["sku"], row["warehouse_id"]),
                )
        for row in rows:
            self._cache.invalidate(row["sku"], row["warehouse_id"])

    def receive_shipment(self, items: List[ReceivedItem]) -> None:
        with self._db.transaction() as tx:
            for item in items:
                tx.execute(
                    "UPDATE stock SET on_hand = on_hand + %s, version = version + 1 "
                    "WHERE sku = %s AND warehouse_id = %s",
                    (item.quantity, item.sku, item.warehouse_id),
                )
        for item in items:
            self._cache.invalidate(item.sku, item.warehouse_id)
