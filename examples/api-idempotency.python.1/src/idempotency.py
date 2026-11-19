import hashlib
import json
import sqlite3
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class StoredResult:
    status: int
    body: str


class KeyConflict(Exception):
    """Same key reused with a different payload."""


class KeyInProgress(Exception):
    """Another request with this key has not finished."""


def fingerprint(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


class IdempotencyStore:
    def __init__(self, conn: sqlite3.Connection, ttl_seconds: int = 86400):
        self.conn = conn
        self.ttl = ttl_seconds
        conn.execute(
            """CREATE TABLE IF NOT EXISTS idempotency (
                 account TEXT NOT NULL,
                 key TEXT NOT NULL,
                 fingerprint TEXT NOT NULL,
                 status INTEGER,
                 body TEXT,
                 created_at REAL NOT NULL,
                 PRIMARY KEY (account, key))"""
        )

    def begin(self, account: str, key: str, fp: str) -> Optional[StoredResult]:
        now = time.time()
        with self.conn:
            self.conn.execute(
                "DELETE FROM idempotency WHERE account = ? AND key = ? AND created_at < ?",
                (account, key, now - self.ttl),
            )
            cur = self.conn.execute(
                "INSERT OR IGNORE INTO idempotency (account, key, fingerprint, created_at) VALUES (?, ?, ?, ?)",
                (account, key, fp, now),
            )
            if cur.rowcount == 1:
                return None
            row = self.conn.execute(
                "SELECT fingerprint, status, body FROM idempotency WHERE account = ? AND key = ?",
                (account, key),
            ).fetchone()
        if row[0] != fp:
            raise KeyConflict(key)
        if row[1] is None:
            raise KeyInProgress(key)
        return StoredResult(status=row[1], body=row[2])

    def finish(self, account: str, key: str, result: StoredResult) -> None:
        with self.conn:
            self.conn.execute(
                "UPDATE idempotency SET status = ?, body = ? WHERE account = ? AND key = ?",
                (result.status, result.body, account, key),
            )

    def abandon(self, account: str, key: str) -> None:
        with self.conn:
            self.conn.execute(
                "DELETE FROM idempotency WHERE account = ? AND key = ? AND status IS NULL",
                (account, key),
            )
