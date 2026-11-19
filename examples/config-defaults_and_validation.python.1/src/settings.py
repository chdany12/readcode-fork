from dataclasses import dataclass

LABEL_FORMATS = {"zpl", "pdf", "png"}


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Settings:
    batch_size: int
    pickup_window_minutes: int
    cutoff_hour_utc: int
    last_pickup_hour_utc: int
    min_parcel_kg: float
    max_parcel_kg: float
    label_format: str
    warehouse_codes: tuple


def _raw(env, key):
    value = env.get(key)
    if value is None or not value.strip():
        return None
    return value.strip()


def _int(env, key, default, lo, hi):
    raw = _raw(env, key)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ConfigError(f"{key} must be an integer, got {raw!r}") from None
    if not lo <= value <= hi:
        raise ConfigError(f"{key} must be between {lo} and {hi}, got {value}")
    return value


def _float(env, key, default, lo, hi):
    raw = _raw(env, key)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise ConfigError(f"{key} must be a number, got {raw!r}") from None
    if not lo <= value <= hi:
        raise ConfigError(f"{key} must be between {lo} and {hi}, got {value}")
    return value


def from_env(env):
    label_format = (_raw(env, "SHIP_LABEL_FORMAT") or "zpl").lower()
    if label_format not in LABEL_FORMATS:
        raise ConfigError(f"SHIP_LABEL_FORMAT must be one of {sorted(LABEL_FORMATS)}")

    codes = tuple(
        c.strip().upper() for c in (_raw(env, "SHIP_WAREHOUSES") or "").split(",") if c.strip()
    )
    if not codes:
        raise ConfigError("SHIP_WAREHOUSES must list at least one warehouse code")

    settings = Settings(
        batch_size=_int(env, "SHIP_BATCH_SIZE", 100, 1, 500),
        pickup_window_minutes=_int(env, "SHIP_PICKUP_WINDOW_MIN", 120, 15, 720),
        cutoff_hour_utc=_int(env, "SHIP_CUTOFF_HOUR", 14, 0, 23),
        last_pickup_hour_utc=_int(env, "SHIP_LAST_PICKUP_HOUR", 18, 0, 23),
        min_parcel_kg=_float(env, "SHIP_MIN_PARCEL_KG", 0.1, 0.0, 100.0),
        max_parcel_kg=_float(env, "SHIP_MAX_PARCEL_KG", 30.0, 0.1, 1000.0),
        label_format=label_format,
        warehouse_codes=codes,
    )

    assert settings.cutoff_hour_utc < settings.last_pickup_hour_utc, "cutoff must precede last pickup"
    assert settings.min_parcel_kg < settings.max_parcel_kg, "min parcel weight must be below max"
    return settings
