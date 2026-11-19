export interface ProviderPayslip {
  employee_ref: string;
  period_start: number;
  period_end: number;
  pay_date: number;
  gross_cents: string;
  net_cents: string;
  currency: string;
  deductions: { code: string; amount_cents: string }[];
}

export interface ProviderPage {
  payslips: ProviderPayslip[];
  next_cursor: string | null;
}

export class PayrollProviderClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async fetchPayslips(runId: string, cursor: string | null): Promise<ProviderPage> {
    const url = new URL(`/v2/runs/${encodeURIComponent(runId)}/payslips`, this.baseUrl);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${this.apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`provider responded ${res.status} for run ${runId}`);
    return (await res.json()) as ProviderPage;
  }
}
