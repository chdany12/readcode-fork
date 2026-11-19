from dataclasses import dataclass
from enum import Enum


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass(frozen=True)
class AuthPolicy:
    require_mfa: bool
    cookie_secure: bool
    session_ttl_seconds: int
    max_failed_logins: int
    allowed_redirect_hosts: frozenset


POLICIES = {
    Environment.DEVELOPMENT: AuthPolicy(
        require_mfa=False,
        cookie_secure=False,
        session_ttl_seconds=7 * 24 * 3600,
        max_failed_logins=100,
        allowed_redirect_hosts=frozenset({"localhost", "127.0.0.1"}),
    ),
    Environment.STAGING: AuthPolicy(
        require_mfa=True,
        cookie_secure=True,
        session_ttl_seconds=8 * 3600,
        max_failed_logins=10,
        allowed_redirect_hosts=frozenset({"staging.accounts.example.com"}),
    ),
    Environment.PRODUCTION: AuthPolicy(
        require_mfa=True,
        cookie_secure=True,
        session_ttl_seconds=3600,
        max_failed_logins=5,
        allowed_redirect_hosts=frozenset({"accounts.example.com", "app.example.com"}),
    ),
}


def current_environment(environ):
    raw = environ.get("IDP_ENV", "development").strip().lower()
    try:
        return Environment(raw)
    except ValueError:
        known = ", ".join(e.value for e in Environment)
        raise RuntimeError(f"IDP_ENV={raw!r} is not one of: {known}") from None


def load_policy(environ):
    env = current_environment(environ)
    return env, POLICIES[env]
