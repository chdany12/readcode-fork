import sqlite3

HOLD_SECONDS = 48 * 3600
MIN_PAYOUT_CENTS = 2000


def run_payout(conn: sqlite3.Connection, driver_id: str, now: int) -> int | None:
    account = f"driver:{driver_id}"
    cutoff = now - HOLD_SECONDS
    with conn:
        (period_start,) = conn.execute(
            "SELECT COALESCE(MAX(period_end), 0) FROM payout WHERE driver_id = ?",
            (driver_id,),
        ).fetchone()
        if cutoff <= period_start:
            return None
        (total,) = conn.execute(
            """
            SELECT COALESCE(SUM(amount_cents), 0)
            FROM ledger_entry
            WHERE account = ?
              AND kind = 'earning'
              AND created_at >= ?
              AND created_at <= ?
            """,
            (account, period_start, cutoff),
        ).fetchone()
        if total < MIN_PAYOUT_CENTS:
            return None
        conn.execute(
            "INSERT INTO payout (driver_id, period_start, period_end, amount_cents, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (driver_id, period_start, cutoff, total, now),
        )
        payout_ref = f"payout:{driver_id}:{cutoff}"
        conn.executemany(
            "INSERT INTO ledger_entry (trip_id, account, amount_cents, kind, created_at)"
            " VALUES (?, ?, ?, 'payout', ?)",
            [(payout_ref, account, -total, now), (payout_ref, "payouts_clearing", total, now)],
        )
    return total
