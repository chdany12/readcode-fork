import logging
from dataclasses import dataclass

from billing.credits import CreditLedger

log = logging.getLogger("billing.invoicing")


class GatewayDeclined(Exception):
    pass


@dataclass(frozen=True)
class Invoice:
    id: str
    customer_id: str
    total_cents: int


class InvoiceFinalizer:
    def __init__(self, credits: CreditLedger, gateway) -> None:
        self._credits = credits
        self._gateway = gateway

    def finalize(self, invoice: Invoice) -> int:
        """Applies available credit, charges the remainder and returns the amount charged."""
        credit_used = self._credits.apply_to_invoice(
            invoice.customer_id, invoice.id, invoice.total_cents
        )
        due = invoice.total_cents - credit_used
        if due == 0:
            return 0
        try:
            self._gateway.charge(invoice.customer_id, due, idempotency_key=invoice.id)
        except GatewayDeclined:
            restored = self._credits.reverse(invoice.customer_id, invoice.id)
            log.info("declined invoice %s, restored %d cents", invoice.id, restored)
            raise
        return due
