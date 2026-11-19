import { Employee, TimesheetEntry, Payslip, TaxBand } from "./model";

const OVERTIME_MULTIPLIER = 1.5;
const WEEKLY_REGULAR_HOURS = 40;

export function groupByEmployee(entries: TimesheetEntry[]): Map<string, TimesheetEntry[]> {
  const out = new Map<string, TimesheetEntry[]>();
  for (const e of entries) {
    const list = out.get(e.employeeId);
    if (list) list.push(e);
    else out.set(e.employeeId, [e]);
  }
  return out;
}

export function weeklyHours(entries: TimesheetEntry[]): Map<string, number> {
  const weeks = new Map<string, number>();
  for (const e of entries) {
    weeks.set(e.isoWeek, (weeks.get(e.isoWeek) ?? 0) + e.hours);
  }
  return weeks;
}

export function grossCents(emp: Employee, entries: TimesheetEntry[]): number {
  if (emp.salaried) return Math.round(emp.annualSalaryCents / 26);
  let total = 0;
  for (const hours of weeklyHours(entries).values()) {
    const regular = Math.min(hours, WEEKLY_REGULAR_HOURS);
    const overtime = Math.max(0, hours - WEEKLY_REGULAR_HOURS);
    total += regular * emp.hourlyRateCents + overtime * emp.hourlyRateCents * OVERTIME_MULTIPLIER;
  }
  return Math.round(total);
}

export function withholdingCents(grossCentsValue: number, bands: TaxBand[]): number {
  let tax = 0;
  for (const band of bands) {
    if (grossCentsValue <= band.fromCents) break;
    const top = band.toCents ?? Infinity;
    const taxable = Math.min(grossCentsValue, top) - band.fromCents;
    tax += taxable * band.rate;
  }
  return Math.round(tax);
}

export function runPayroll(
  employees: Employee[],
  entries: TimesheetEntry[],
  bandsByRegion: Map<string, TaxBand[]>,
): Payslip[] {
  const sortedBands = new Map<string, TaxBand[]>();
  for (const [region, bands] of bandsByRegion) {
    sortedBands.set(region, [...bands].sort((a, b) => a.fromCents - b.fromCents));
  }

  const slips: Payslip[] = [];
  for (const emp of employees) {
    const mine = entries.filter((e) => e.employeeId === emp.id);
    const gross = grossCents(emp, mine);
    const bands = sortedBands.get(emp.region);
    if (!bands) throw new Error(`no tax bands for region ${emp.region} (employee ${emp.id})`);
    const tax = withholdingCents(gross, bands);
    slips.push({ employeeId: emp.id, grossCents: gross, taxCents: tax, netCents: gross - tax });
  }
  return slips;
}
