import logging
from decimal import Decimal
from typing import Dict

from payroll.adjustments import AdjustmentLedger, PeriodClosedError

log = logging.getLogger("payroll")


class PayrollService:
    def __init__(self, ledger: AdjustmentLedger, base_pay: Dict[str, Decimal], payout) -> None:
        self._ledger = ledger
        self._base_pay = base_pay
        self._payout = payout

    def run(self) -> int:
        try:
            adjustments = self._ledger.close_period()
        except PeriodClosedError:
            log.warning("payroll run skipped: period already closed")
            return 0
        paid = 0
        for employee_id, base in self._base_pay.items():
            net = base + adjustments.get(employee_id, Decimal("0"))
            if net <= 0:
                log.info("no payout for %s", employee_id)
                continue
            self._payout(employee_id, net)
            paid += 1
        return paid

    def dashboard(self) -> Dict[str, str]:
        return {emp: f"{net:.2f}" for emp, net in self._ledger.preview().items()}
