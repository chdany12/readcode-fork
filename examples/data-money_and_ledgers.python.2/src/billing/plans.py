from dataclasses import dataclass
from datetime import date

from billing.money import allocate, prorate


@dataclass(frozen=True)
class Plan:
    code: str
    price_cents: int


@dataclass(frozen=True)
class InvoiceLine:
    description: str
    amount_cents: int


@dataclass(frozen=True)
class PlanChange:
    subscription_id: str
    old_plan: Plan
    new_plan: Plan
    change_date: date
    period_start: date
    period_end: date


def apply_discount(lines: list, discount_cents: int) -> list:
    subtotal = sum(line.amount_cents for line in lines)
    discount = min(discount_cents, subtotal)
    if discount <= 0:
        return list(lines)
    shares = allocate(discount, [line.amount_cents for line in lines])
    return [
        InvoiceLine(line.description, line.amount_cents - share)
        for line, share in zip(lines, shares)
    ]


def change_plan(ledger, change: PlanChange) -> int:
    days_in_period = (change.period_end - change.period_start).days
    days_used = (change.change_date - change.period_start).days
    days_left = days_in_period - days_used

    kept_revenue = prorate(change.old_plan.price_cents, days_used, days_in_period)
    unused_credit = change.old_plan.price_cents - kept_revenue
    new_charge = prorate(change.new_plan.price_cents, days_left, days_in_period)
    net = new_charge - unused_credit

    journal = {
        "key": f"plan-change:{change.subscription_id}:{change.change_date.isoformat()}",
        "entries": [
            {"account": f"receivable:{change.subscription_id}", "amount": net},
            {"account": "revenue:subscriptions", "amount": unused_credit - new_charge},
        ],
    }
    if not ledger.post(journal):
        return 0
    return net
