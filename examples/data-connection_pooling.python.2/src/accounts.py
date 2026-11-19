import hmac
from dataclasses import dataclass

from db import Database


@dataclass(frozen=True)
class User:
    id: int
    email: str
    password_hash: str
    locked: bool


class AccountRepository:
    def __init__(self, db: Database):
        self._db = db

    def find_by_email(self, email: str) -> User | None:
        with self._db.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, email, password_hash, locked FROM users WHERE email = %s",
                    (email.lower(),),
                )
                row = cur.fetchone()
        return User(*row) if row else None

    def roles_for(self, user_id: int) -> list[str]:
        with self._db.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT role FROM user_roles WHERE user_id = %s", (user_id,))
                return [r[0] for r in cur.fetchall()]

    def record_failed_login(self, user_id: int, ip: str) -> int:
        conn = self._db.pool.getconn()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO login_failures (user_id, ip, at) VALUES (%s, %s, now())",
                (user_id, ip),
            )
            cur.execute(
                "SELECT count(*) FROM login_failures WHERE user_id = %s AND at > now() - interval '15 minutes'",
                (user_id,),
            )
            (count,) = cur.fetchone()
        conn.commit()
        self._db.pool.putconn(conn)
        return count

    def lock(self, user_id: int) -> None:
        with self._db.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET locked = true WHERE id = %s", (user_id,))
