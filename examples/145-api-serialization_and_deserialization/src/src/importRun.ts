import { PayrollProviderClient } from "./providerClient";
import { mapPayslip, Payslip } from "./payslipMapper";

export interface PayslipRepo {
  upsert(runId: string, slip: Payslip): Promise<void>;
}

export interface ImportSummary {
  imported: number;
  rejected: { employeeRef: string; reason: string }[];
}

export async function importRun(
  client: PayrollProviderClient,
  repo: PayslipRepo,
  runId: string,
): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, rejected: [] };
  let cursor: string | null = null;
  do {
    const page = await client.fetchPayslips(runId, cursor);
    for (const raw of page.payslips) {
      let slip: Payslip;
      try {
        slip = mapPayslip(raw);
      } catch (err) {
        summary.rejected.push({ employeeRef: raw.employee_ref, reason: (err as Error).message });
        continue;
      }
      await repo.upsert(runId, slip);
      summary.imported++;
    }
    cursor = page.next_cursor;
  } while (cursor);
  return summary;
}
