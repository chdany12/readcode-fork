import copy
import json
from dataclasses import dataclass
from decimal import Decimal
from typing import Mapping, Optional

DEFAULTS = {
    "service": {"name": "ledger-api", "port": 8080},
    "limits": {"per_transfer": "5000.00", "daily_per_account": "20000.00"},
    "reconciliation": {"interval_seconds": 300, "max_drift_cents": 0},
}


@dataclass(frozen=True)
class Settings:
    service_name: str
    port: int
    per_transfer_limit: Optional[Decimal]
    daily_limit: Optional[Decimal]
    reconcile_every_s: int
    max_drift_cents: int

    def transfer_allowed(self, amount: Decimal, spent_today: Decimal) -> bool:
        if self.per_transfer_limit is not None and amount > self.per_transfer_limit:
            return False
        if self.daily_limit is not None and spent_today + amount > self.daily_limit:
            return False
        return True


def load_settings(path: Optional[str] = None, environ: Optional[Mapping[str, str]] = None) -> Settings:
    environ = {} if environ is None else environ
    file_data = _read_file(path) if path else {}
    merged = {**copy.deepcopy(DEFAULTS), **file_data}
    _apply_env(merged, environ)
    return _build(merged)


def _read_file(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: top level must be an object")
    return data


def _apply_env(merged: dict, environ: Mapping[str, str]) -> None:
    port = environ.get("LEDGER_PORT")
    if port:
        merged["service"]["port"] = int(port)
    per_transfer = environ.get("LEDGER_PER_TRANSFER_LIMIT")
    if per_transfer:
        merged["limits"]["per_transfer"] = per_transfer


def _money(value) -> Optional[Decimal]:
    if value is None:
        return None
    amount = Decimal(str(value))
    if amount <= 0:
        raise ValueError(f"limit must be positive, got {amount}")
    return amount


def _build(raw: dict) -> Settings:
    service = raw["service"]
    limits = raw["limits"]
    recon = raw["reconciliation"]
    return Settings(
        service_name=str(service["name"]),
        port=int(service["port"]),
        per_transfer_limit=_money(limits.get("per_transfer")),
        daily_limit=_money(limits.get("daily_per_account")),
        reconcile_every_s=int(recon["interval_seconds"]),
        max_drift_cents=int(recon["max_drift_cents"]),
    )
