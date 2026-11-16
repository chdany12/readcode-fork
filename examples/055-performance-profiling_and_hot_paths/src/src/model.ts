export interface Employee {
  id: string;
  region: string;
  salaried: boolean;
  annualSalaryCents: number;
  hourlyRateCents: number;
}

export interface TimesheetEntry {
  employeeId: string;
  isoWeek: string;
  hours: number;
}

export interface TaxBand {
  fromCents: number;
  toCents: number | null;
  rate: number;
}

export interface Payslip {
  employeeId: string;
  grossCents: number;
  taxCents: number;
  netCents: number;
}
