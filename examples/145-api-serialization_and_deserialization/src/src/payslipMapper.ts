import { ProviderPayslip } from "./providerClient";

export interface Payslip {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  grossCents: bigint;
  netCents: bigint;
  currency: string;
  deductions: Map<string, bigint>;
}

function toCents(field: string, value: string): bigint {
  if (!/^-?\d+$/.test(value)) throw new Error(`${field} is not an integer string: ${value}`);
  return BigInt(value);
}

function fromEpochSeconds(field: string, value: number): Date {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} is not a valid epoch`);
  return new Date(value * 1000);
}

export function mapPayslip(p: ProviderPayslip): Payslip {
  const deductions = new Map<string, bigint>();
  for (const d of p.deductions ?? []) {
    const prev = deductions.get(d.code) ?? 0n;
    deductions.set(d.code, prev + toCents(`deduction ${d.code}`, d.amount_cents));
  }
  const gross = toCents("gross_cents", p.gross_cents);
  const net = toCents("net_cents", p.net_cents);
  const totalDeductions = [...deductions.values()].reduce((a, b) => a + b, 0n);
  if (gross - totalDeductions !== net) {
    throw new Error(`payslip for ${p.employee_ref} does not balance`);
  }
  return {
    employeeId: p.employee_ref,
    periodStart: fromEpochSeconds("period_start", p.period_start),
    periodEnd: fromEpochSeconds("period_end", p.period_end),
    payDate: new Date(p.pay_date),
    grossCents: gross,
    netCents: net,
    currency: p.currency.toUpperCase(),
    deductions,
  };
}
