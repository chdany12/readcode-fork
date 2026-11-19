import sqlite3
from decimal import Decimal, ROUND_HALF_UP

PLATFORM_RATE = Decimal("0.25")


def split_fare(fare_cents: int, tip_cents: int = 0) -> tuple[int, int]:
    """Return (platform_fee_cents, driver_share_cents). Tips go entirely to the driver."""
    fee = int((Decimal(fare_cents) * PLATFORM_RATE).quantize(Decimal("1"), ROUND_HALF_UP))
    return fee, fare_cents - fee + tip_cents


def settle_trip(conn: sqlite3.Connection, trip_id: str, driver_id: str,
                fare_cents: int, tip_cents: int, now: int) -> bool:
    fee, driver_share = split_fare(fare_cents, tip_cents)
    entries = [
        ("rider_charges", -(fare_cents + tip_cents), "charge"),
        ("platform_revenue", fee, "fee"),
        (f"driver:{driver_id}", driver_share, "earning"),
    ]
    if sum(amount for _, amount, _ in entries) != 0:
        raise AssertionError(f"unbalanced settlement for {trip_id}")
    try:
        with conn:
            conn.execute("INSERT INTO settlement (trip_id, settled_at) VALUES (?, ?)", (trip_id, now))
            conn.executemany(
                "INSERT INTO ledger_entry (trip_id, account, amount_cents, kind, created_at)"
                " VALUES (?, ?, ?, ?, ?)",
                [(trip_id, account, amount, kind, now) for account, amount, kind in entries],
            )
    except sqlite3.IntegrityError:
        return False
    return True
