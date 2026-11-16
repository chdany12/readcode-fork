export class TaxEstimator {
  constructor(private readonly flatRate: number) {}

  estimate(taxableCents: number): number {
    if (taxableCents <= 0) return 0;
    return Math.round(taxableCents * this.flatRate);
  }
}
