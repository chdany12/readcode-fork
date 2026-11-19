from dataclasses import dataclass

from flags import Flags


@dataclass(frozen=True)
class Charge:
    charge_id: str
    merchant_id: str
    amount_cents: int
    card_bin: str


class ChargeRouter:
    def __init__(self, flags: Flags, processor_a, processor_b, blocked_bins: set[str]):
        self._flags = flags
        self._a = processor_a
        self._b = processor_b
        self._blocked_bins = blocked_bins

    def submit(self, charge: Charge):
        if self._flags.is_enabled("block-new-card-bins", charge.merchant_id):
            if charge.card_bin in self._blocked_bins:
                raise ValueError("card bin blocked")
        processor = self._b if self._flags.is_enabled("route-via-processor-b", charge.merchant_id) else self._a
        return processor.authorize(charge.charge_id, charge.amount_cents)
