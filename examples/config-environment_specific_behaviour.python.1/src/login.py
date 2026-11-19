import hmac
from urllib.parse import urlparse

from policy import AuthPolicy


class LoginDenied(Exception):
    pass


def _safe_redirect(policy: AuthPolicy, target: str, default: str = "/") -> str:
    parsed = urlparse(target)
    if not parsed.scheme and not parsed.netloc:
        return target if target.startswith("/") and not target.startswith("//") else default
    if parsed.hostname in policy.allowed_redirect_hosts:
        return target
    return default


class LoginService:
    def __init__(self, policy: AuthPolicy, users, totp, failures):
        self._policy = policy
        self._users = users
        self._totp = totp
        self._failures = failures

    def login(self, username, password, otp_code, next_url="/"):
        if self._failures.count(username) >= self._policy.max_failed_logins:
            raise LoginDenied("account temporarily locked")

        user = self._users.find(username)
        stored = user.password_hash if user else self._users.dummy_hash()
        password_ok = hmac.compare_digest(self._users.hash(password, stored), stored)
        if not user or not password_ok:
            self._failures.record(username)
            raise LoginDenied("invalid credentials")

        if self._policy.require_mfa:
            if not otp_code or not self._totp.verify(user.totp_secret, otp_code):
                self._failures.record(username)
                raise LoginDenied("second factor required")

        self._failures.reset(username)
        return {
            "user_id": user.id,
            "cookie": {
                "max_age": self._policy.session_ttl_seconds,
                "secure": self._policy.cookie_secure,
                "http_only": True,
                "same_site": "Lax",
            },
            "redirect": _safe_redirect(self._policy, next_url),
        }
