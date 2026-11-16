export type Currency = "USD" | "EUR" | "GBP" | "JPY";

export const MINOR_UNITS: Record<Currency, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0 };

export interface FeeSchedule {
  percentBps: number;
  fixedMinor: number;
  capMinor: number | null;
}

export const SCHEDULES: Record<string, FeeSchedule> = {
  standard: { percentBps: 290, fixedMinor: 30, capMinor: null },
  enterprise: { percentBps: 220, fixedMinor: 15, capMinor: 2_500 },
};

export function processingFee(amountMinor: number, schedule: FeeSchedule): number {
  const pct = Math.round((amountMinor * schedule.percentBps) / 10_000);
  const fee = pct + schedule.fixedMinor;
  return schedule.capMinor === null ? fee : Math.min(fee, schedule.capMinor);
}
