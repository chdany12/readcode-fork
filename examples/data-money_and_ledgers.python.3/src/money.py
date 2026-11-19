def allocate(total_cents: int, weights: list[int]) -> list[int]:
    """Split total_cents across weights in proportion."""
    total_weight = sum(weights)
    if total_weight <= 0:
        raise ValueError("weights must sum to a positive number")
    return [total_cents * w // total_weight for w in weights]
