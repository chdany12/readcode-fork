import logging
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool as pgpool

log = logging.getLogger("iam.db")


class ServiceUnavailable(Exception):
    pass


class Database:
    def __init__(self, dsn: str, minconn: int = 2, maxconn: int = 10):
        self.pool = pgpool.ThreadedConnectionPool(minconn, maxconn, dsn, connect_timeout=3)

    @contextmanager
    def connection(self):
        try:
            conn = self.pool.getconn()
        except pgpool.PoolError as exc:
            raise ServiceUnavailable("database pool exhausted") from exc
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self.pool.putconn(conn)

    def ping(self) -> bool:
        try:
            with self.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            return True
        except (ServiceUnavailable, psycopg2.Error):
            log.warning("database ping failed")
            return False

    def close(self) -> None:
        self.pool.closeall()
