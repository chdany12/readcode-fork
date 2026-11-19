import {
  Employee,
  FlagStore,
  Payslip,
  grossForPeriod,
  withholdingV1,
  withholdingV2,
} from "./payrollCalc";

export interface PayrollRepo {
  employeesForRun(runId: string): Promise<Employee[]>;
  savePayslips(runId: string, slips: Payslip[]): Promise<void>;
  markRunStatus(runId: string, status: "processing" | "done" | "failed"): Promise<void>;
}

export class PayrollRunner {
  constructor(
    private readonly repo: PayrollRepo,
    private readonly flags: FlagStore,
  ) {}

  async execute(runId: string): Promise<Payslip[]> {
    await this.repo.markRunStatus(runId, "processing");
    try {
      const employees = await this.repo.employeesForRun(runId);
      const slips: Payslip[] = [];
      for (const e of employees) {
        slips.push(await this.computeSlip(e));
      }
      await this.repo.savePayslips(runId, slips);
      await this.repo.markRunStatus(runId, "done");
      return slips;
    } catch (err) {
      await this.repo.markRunStatus(runId, "failed");
      throw new Error(`payroll run ${runId} failed: ${String(err)}`);
    }
  }

  private async computeSlip(e: Employee): Promise<Payslip> {
    const useV2 = await this.flags.getBoolean("tax_engine_v2", false);
    const gross = grossForPeriod(e);
    const taxableIncome = Math.max(0, gross - e.pretaxDeductions);
    const withholding = useV2
      ? withholdingV2(taxableIncome, e.state)
      : withholdingV1(taxableIncome);
    return {
      employeeId: e.id,
      gross,
      taxableIncome,
      withholding,
      net: Math.round((gross - withholding) * 100) / 100,
      engine: useV2 ? "v2" : "v1",
    };
  }
}
