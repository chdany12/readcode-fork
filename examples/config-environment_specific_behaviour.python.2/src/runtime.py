from dataclasses import dataclass


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Profile:
    name: str
    sample_rate: float
    batch_size: int
    flush_interval_s: float
    require_tls: bool
    allow_simulator: bool


PROFILES = {
    "local": Profile("local", 1.0, 1, 0.0, False, True),
    "staging": Profile("staging", 0.1, 100, 5.0, True, True),
    "production": Profile("production", 1.0, 500, 2.0, True, False),
}


def load_profile(environ):
    name = (environ.get("TELEMETRY_ENV") or "").strip().lower()
    if not name:
        raise ConfigError("TELEMETRY_ENV must be set")
    try:
        profile = PROFILES[name]
    except KeyError:
        raise ConfigError(f"unknown TELEMETRY_ENV {name!r}") from None

    broker = (environ.get("BROKER_URL") or "").strip()
    if profile.require_tls and not broker.startswith("mqtts://"):
        raise ConfigError(f"{profile.name} requires a TLS broker (mqtts://), got {broker!r}")

    if environ.get("ENABLE_SIMULATOR") == "1" and not profile.allow_simulator:
        raise ConfigError(f"device simulator is not permitted in {profile.name}")
    return profile, broker
