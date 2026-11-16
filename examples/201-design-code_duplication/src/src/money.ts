export type Cents = number;

export interface PayPeriod {
  start: string;
  end: string;
  workingDays: number;
}

export function roundCents(value: number): Cents {
  return Math.round(value);
}

export function prorate(amount: Cents, daysWorked: number, period: PayPeriod): Cents {
  if (daysWorked < 0 || daysWorked > period.workingDays) {
    throw new RangeError(`daysWorked ${daysWorked} outside 0..${period.workingDays}`);
  }
  return roundCents((amount * daysWorked) / period.workingDays);
}

export function applyBrackets(taxable: Cents, brackets: Array<{ upTo: Cents | null; rate: number }>): Cents {
  let remaining = taxable;
  let lower: Cents = 0;
  let tax = 0;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const width = b.upTo === null ? remaining : Math.min(remaining, b.upTo - lower);
    tax += width * b.rate;
    remaining -= width;
    if (b.upTo !== null) lower = b.upTo;
  }
  return roundCents(tax);
}
