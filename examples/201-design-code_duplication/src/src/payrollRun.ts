import { PayPeriod } from "./money";
import { Employee, Payslip, finalPayslip, partialPeriodPayslip, regularPayslip } from "./payslipCalculator";

export interface LeaveLedger {
  unusedLeaveCents(employeeId: string, asOf: string): Promise<number>;
}

function daysBetween(fromIso: string, toIso: string, period: PayPeriod): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  const calendar = Math.floor(ms / 86_400_000) + 1;
  return Math.max(0, Math.min(period.workingDays, Math.round((calendar * 5) / 7)));
}

export async function runPayroll(
  employees: Employee[],
  period: PayPeriod,
  leave: LeaveLedger,
): Promise<Payslip[]> {
  const slips: Payslip[] = [];
  for (const e of employees) {
    if (e.terminationDate && e.terminationDate >= period.start && e.terminationDate <= period.end) {
      const from = e.hireDate && e.hireDate > period.start ? e.hireDate : period.start;
      const days = daysBetween(from, e.terminationDate, period);
      const payout = await leave.unusedLeaveCents(e.id, e.terminationDate);
      slips.push(finalPayslip(e, period, days, payout));
    } else if (e.hireDate && e.hireDate > period.start && e.hireDate <= period.end) {
      slips.push(partialPeriodPayslip(e, period, daysBetween(e.hireDate, period.end, period)));
    } else if (!e.terminationDate || e.terminationDate > period.end) {
      slips.push(regularPayslip(e, period));
    }
  }
  return slips;
}
