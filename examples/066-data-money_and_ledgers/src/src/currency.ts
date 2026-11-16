export const MINOR_UNITS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
};

export function minorUnitsOf(currency: string): number {
  const units = MINOR_UNITS[currency];
  if (units === undefined) throw new Error(`unsupported currency ${currency}`);
  return units;
}

export function formatMinor(amountMinor: number, currency: string): string {
  const units = minorUnitsOf(currency);
  const major = amountMinor / 10 ** units;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: units,
    maximumFractionDigits: units,
  }).format(major);
}

export function majorToMinor(major: string, currency: string): number {
  const units = minorUnitsOf(currency);
  const [intPart, fracPart = ""] = major.split(".");
  if (fracPart.length > units) {
    throw new Error(`${major} has more precision than ${currency} allows`);
  }
  const padded = fracPart.padEnd(units, "0");
  return Number(intPart) * 10 ** units + (padded ? Number(padded) : 0);
}
