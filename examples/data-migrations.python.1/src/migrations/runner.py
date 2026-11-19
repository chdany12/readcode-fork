import hashlib
import logging
import time
from dataclasses import dataclass

log = logging.getLogger("migrations")

LOCK_ID = 724019


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    statements: tuple

    @property
    def checksum(self) -> str:
        return hashlib.sha256("\n".join(self.statements).encode()).hexdigest()


class MigrationRunner:
    def __init__(self, pool, migrations):
        self._pool = pool
        self._migrations = sorted(migrations, key=lambda m: m.version)

    def upgrade(self) -> int:
        conn = self._pool.getconn()
        conn.autocommit = True
        applied_count = 0
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_lock(%s)", (LOCK_ID,))
                try:
                    self._ensure_table(cur)
                    applied = self._load_applied(cur)
                    for migration in self._migrations:
                        recorded = applied.get(migration.version)
                        if recorded is not None:
                            if recorded != migration.checksum:
                                raise RuntimeError(
                                    f"migration {migration.version} changed after it was applied"
                                )
                            continue
                        self._apply(cur, migration)
                        applied_count += 1
                finally:
                    cur.execute("SELECT pg_advisory_unlock(%s)", (LOCK_ID,))
        finally:
            self._pool.putconn(conn)
        return applied_count

    def _ensure_table(self, cur):
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version    integer PRIMARY KEY,
                name       text NOT NULL,
                checksum   text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )

    def _load_applied(self, cur) -> dict:
        cur.execute("SELECT version, checksum FROM schema_migrations")
        return {version: checksum for version, checksum in cur.fetchall()}

    def _apply(self, cur, migration: Migration):
        started = time.monotonic()
        cur.execute("BEGIN")
        try:
            for statement in migration.statements:
                cur.execute(statement)
            cur.execute("COMMIT")
        except Exception:
            cur.execute("ROLLBACK")
            log.exception("migration %s failed", migration.version)
            raise
        cur.execute(
            "INSERT INTO schema_migrations (version, name, checksum) VALUES (%s, %s, %s)",
            (migration.version, migration.name, migration.checksum),
        )
        log.info(
            "applied migration %s (%s) in %.2fs",
            migration.version,
            migration.name,
            time.monotonic() - started,
        )
