export interface BenefitsDeduction {
  code: string;
  label: string;
  amountCents: number;
  preTax: boolean;
}

export class BenefitsClient {
  constructor(private readonly baseUrl: string) {}

  async listDeductions(employeeId: string, periodId: string): Promise<BenefitsDeduction[]> {
    const res = await fetch(`${this.baseUrl}/employees/${encodeURIComponent(employeeId)}/deductions?period=${encodeURIComponent(periodId)}`);
    if (!res.ok) {
      throw new Error(`benefits responded ${res.status}`);
    }
    const body = (await res.json()) as { deductions: BenefitsDeduction[] };
    return body.deductions;
  }
}
