export interface FlagStore {
  getBoolean(key: string, fallback: boolean): Promise<boolean>;
}

export interface Employee {
  id: string;
  annualSalary: number;
  state: string;
  pretaxDeductions: number;
}

export interface Payslip {
  employeeId: string;
  gross: number;
  taxableIncome: number;
  withholding: number;
  net: number;
  engine: "v1" | "v2";
}

const PERIODS_PER_YEAR = 26;

export function grossForPeriod(e: Employee): number {
  return Math.round((e.annualSalary / PERIODS_PER_YEAR) * 100) / 100;
}

export function withholdingV1(taxable: number): number {
  return Math.round(taxable * 0.22 * 100) / 100;
}

export function withholdingV2(taxable: number, state: string): number {
  const federal = taxable * 0.2;
  const stateRate = state === "CA" ? 0.06 : state === "NY" ? 0.055 : 0.03;
  return Math.round((federal + taxable * stateRate) * 100) / 100;
}
