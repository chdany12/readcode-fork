def prorate(amount_cents: int, days: int, days_in_period: int) -> int:
    """Return amount_cents * days / days_in_period rounded half-to-even."""
    if days_in_period <= 0 or not 0 <= days <= days_in_period:
        raise ValueError("days must be within the billing period")
    quotient, remainder = divmod(amount_cents * days, days_in_period)
    twice = remainder * 2
    if twice > days_in_period or (twice == days_in_period and quotient % 2 == 1):
        quotient += 1
    return quotient


def allocate(total_cents: int, weights: list) -> list:
    """Split total_cents proportionally to weights; shares always sum to total_cents."""
    if total_cents < 0 or not weights or any(w < 0 for w in weights):
        raise ValueError("invalid allocation input")
    denominator = sum(weights)
    if denominator == 0:
        raise ValueError("weights must not all be zero")

    shares = [total_cents * w // denominator for w in weights]
    remainders = [total_cents * w % denominator for w in weights]
    leftover = total_cents - sum(shares)
    by_remainder = sorted(range(len(weights)), key=lambda i: (-remainders[i], i))
    for i in by_remainder[:leftover]:
        shares[i] += 1
    return shares
