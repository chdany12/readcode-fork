import sqlite3

from pool import ConnectionPool

SCHEMA = """
CREATE TABLE IF NOT EXISTS build_results (
    build_id TEXT PRIMARY KEY,
    repo TEXT NOT NULL,
    status TEXT NOT NULL,
    finished_at TEXT NOT NULL
)
"""


def make_pool(path: str) -> ConnectionPool:
    def factory():
        return sqlite3.connect(path, timeout=2.0, check_same_thread=False)

    pool = ConnectionPool(
        factory,
        broken_errors=(sqlite3.OperationalError, sqlite3.InterfaceError),
        max_size=8,
        acquire_timeout=3.0,
    )
    with pool.connection() as conn:
        conn.execute(SCHEMA)
        conn.commit()
    return pool


class BuildStore:
    def __init__(self, pool: ConnectionPool):
        self._pool = pool

    def record_result(self, build_id: str, repo: str, status: str, finished_at: str) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO build_results VALUES (?, ?, ?, ?)",
                (build_id, repo, status, finished_at),
            )
            conn.commit()

    def failure_count(self, repo: str, since: str) -> int:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM build_results WHERE repo = ? AND status = 'failed' AND finished_at >= ?",
                (repo, since),
            ).fetchone()
        return row[0]
