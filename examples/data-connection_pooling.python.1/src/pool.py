import queue
import threading
import time
from contextlib import contextmanager


class PoolExhausted(Exception):
    pass


class _Lease:
    __slots__ = ("conn", "created")

    def __init__(self, conn, created):
        self.conn = conn
        self.created = created


class ConnectionPool:
    def __init__(
        self,
        factory,
        broken_errors,
        max_size=10,
        acquire_timeout=5.0,
        max_age=1800.0,
        clock=time.monotonic,
    ):
        self._factory = factory
        self._broken_errors = broken_errors
        self._acquire_timeout = acquire_timeout
        self._max_age = max_age
        self._clock = clock
        self._slots = threading.BoundedSemaphore(max_size)
        self._idle = queue.LifoQueue()

    def acquire(self) -> _Lease:
        if not self._slots.acquire(timeout=self._acquire_timeout):
            raise PoolExhausted(f"no connection within {self._acquire_timeout}s")
        try:
            return self._checkout()
        except BaseException:
            self._slots.release()
            raise

    def _checkout(self) -> _Lease:
        while True:
            try:
                conn, created = self._idle.get_nowait()
            except queue.Empty:
                return _Lease(self._factory(), self._clock())
            if self._clock() - created > self._max_age or not self._healthy(conn):
                self._close(conn)
                continue
            return _Lease(conn, created)

    def release(self, lease: _Lease, broken: bool = False) -> None:
        try:
            if broken or self._clock() - lease.created > self._max_age:
                self._close(lease.conn)
                return
            try:
                lease.conn.rollback()
            except Exception:
                self._close(lease.conn)
                return
            self._idle.put((lease.conn, lease.created))
        finally:
            self._slots.release()

    @contextmanager
    def connection(self):
        lease = self.acquire()
        broken = False
        try:
            yield lease.conn
        except self._broken_errors:
            broken = True
            raise
        finally:
            self.release(lease, broken)

    def _healthy(self, conn) -> bool:
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
            conn.rollback()
            return True
        except Exception:
            return False

    @staticmethod
    def _close(conn) -> None:
        try:
            conn.close()
        except Exception:
            pass
