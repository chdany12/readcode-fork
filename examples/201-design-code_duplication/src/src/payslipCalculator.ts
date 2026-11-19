import { Cents, PayPeriod, applyBrackets, prorate } from "./money";

export interface Employee {
  id: string;
  monthlySalary: Cents;
  pretaxDeductions: Cents;
  hireDate: string | null;
  terminationDate: string | null;
}

export interface Payslip {
  employeeId: string;
  gross: Cents;
  taxable: Cents;
  withholding: Cents;
  net: Cents;
}

const BRACKETS = [
  { upTo: 100_000, rate: 0.1 },
  { upTo: 400_000, rate: 0.22 },
  { upTo: null, rate: 0.32 },
];

function buildPayslip(employeeId: string, gross: Cents, pretax: Cents): Payslip {
  const taxable = Math.max(0, gross - pretax);
  const withholding = applyBrackets(taxable, BRACKETS);
  return { employeeId, gross, taxable, withholding, net: gross - pretax - withholding };
}

export function regularPayslip(e: Employee, period: PayPeriod): Payslip {
  return buildPayslip(e.id, e.monthlySalary, e.pretaxDeductions);
}

export function partialPeriodPayslip(e: Employee, period: PayPeriod, daysWorked: number): Payslip {
  const gross = prorate(e.monthlySalary, daysWorked, period);
  const pretax = prorate(e.pretaxDeductions, daysWorked, period);
  return buildPayslip(e.id, gross, pretax);
}

export function finalPayslip(
  e: Employee,
  period: PayPeriod,
  daysWorked: number,
  unusedLeavePayout: Cents,
): Payslip {
  const base = prorate(e.monthlySalary, daysWorked, period);
  const pretax = prorate(e.pretaxDeductions, daysWorked, period);
  return buildPayslip(e.id, base + unusedLeavePayout, pretax);
}
