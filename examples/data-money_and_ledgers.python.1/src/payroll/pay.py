import json
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

CENTS = Decimal("0.01")
STANDARD_WEEK_HOURS = Decimal("40")


def to_cents(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class PayPolicy:
    overtime_multiplier: Decimal
    withholding_rate: Decimal
    employer_match_rate: Decimal


@dataclass(frozen=True)
class Employee:
    id: str
    hourly_rate: Decimal


@dataclass(frozen=True)
class PayStub:
    employee_id: str
    gross: Decimal
    withholding: Decimal
    net: Decimal


def load_policy(path: Path) -> PayPolicy:
    raw = json.loads(path.read_text())
    return PayPolicy(
        overtime_multiplier=Decimal(str(raw["overtime_multiplier"])),
        withholding_rate=Decimal(raw["withholding_rate"]),
        employer_match_rate=Decimal(str(raw["employer_match_rate"])),
    )


def compute_stub(employee: Employee, hours: Decimal, policy: PayPolicy) -> PayStub:
    if hours < 0:
        raise ValueError("hours must not be negative")

    regular_hours = min(hours, STANDARD_WEEK_HOURS)
    overtime_hours = hours - regular_hours

    regular_pay = regular_hours * employee.hourly_rate
    overtime_pay = overtime_hours * employee.hourly_rate * policy.overtime_multiplier

    gross = to_cents(regular_pay + overtime_pay)
    withholding = to_cents(gross * policy.withholding_rate)
    net = gross - withholding
    return PayStub(employee.id, gross, withholding, net)
