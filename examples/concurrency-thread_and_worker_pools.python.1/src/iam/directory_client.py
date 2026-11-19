import threading
from typing import Callable, FrozenSet


class DirectoryError(Exception):
    pass


class DirectoryClient:
    """Looks up group memberships in the corporate directory.

    Each worker thread keeps its own connection because the underlying
    connection object is not safe to share between threads.
    """

    def __init__(self, connect: Callable[[float], "Connection"], timeout_s: float = 2.0):
        self._connect = connect
        self._timeout_s = timeout_s
        self._local = threading.local()

    def _connection(self):
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = self._connect(self._timeout_s)
            self._local.conn = conn
        return conn

    def groups_for(self, principal_id: str) -> FrozenSet[str]:
        conn = self._connection()
        try:
            return frozenset(conn.search_groups(principal_id))
        except (ConnectionError, TimeoutError) as exc:
            self._local.conn = None
            raise DirectoryError(f"directory lookup failed for {principal_id}") from exc
