import { BankClient } from "./bankClient";
import { DisbursementRepo, PayrollLine, PayrollRun, TransientBankError } from "./types";

const MAX_ATTEMPTS = 4;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PayrollDisburser {
  constructor(private readonly bank: BankClient, private readonly repo: DisbursementRepo) {}

  async disburse(run: PayrollRun): Promise<{ submitted: number; failed: number }> {
    let submitted = 0;
    let failed = 0;
    for (const line of run.lines) {
      const current = await this.repo.status(run.id, line.employeeId);
      if (current === "submitted") {
        submitted++;
        continue;
      }
      await this.repo.markPending(run.id, line.employeeId);
      try {
        const transferId = await this.payWithRetry(run, line);
        await this.repo.markSubmitted(run.id, line.employeeId, transferId);
        submitted++;
      } catch (err) {
        await this.repo.markFailed(run.id, line.employeeId, (err as Error).message);
        failed++;
      }
    }
    return { submitted, failed };
  }

  private async payWithRetry(run: PayrollRun, line: PayrollLine): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      const idempotencyKey = `payroll:${run.id}:${line.employeeId}:${attempt}`;
      try {
        const { transferId } = await this.bank.createTransfer({
          amountCents: line.netAmountCents,
          currency: line.currency,
          destinationToken: line.bankAccountToken,
          reference: `Salary ${run.payDate}`,
          idempotencyKey,
        });
        return transferId;
      } catch (err) {
        if (!(err instanceof TransientBankError) || attempt >= MAX_ATTEMPTS) {
          throw err;
        }
        await delay(250 * 2 ** attempt);
      }
    }
  }
}
