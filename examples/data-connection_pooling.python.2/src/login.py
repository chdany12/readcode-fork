from accounts import AccountRepository, User

MAX_FAILURES = 5


class LoginService:
    def __init__(self, accounts: AccountRepository, verify):
        self._accounts = accounts
        self._verify = verify

    def login(self, email: str, password: str, ip: str) -> tuple[User, list[str]] | None:
        user = self._accounts.find_by_email(email)
        if user is None or user.locked:
            return None
        if not self._verify(password, user.password_hash):
            failures = self._accounts.record_failed_login(user.id, ip)
            if failures >= MAX_FAILURES:
                self._accounts.lock(user.id)
            return None
        return user, self._accounts.roles_for(user.id)
