export interface PayrollLine {
  employeeId: string;
  netAmountCents: number;
  currency: string;
  bankAccountToken: string;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  payDate: string;
  lines: PayrollLine[];
}

export type DisbursementStatus = "pending" | "submitted" | "failed";

export interface DisbursementRepo {
  status(runId: string, employeeId: string): Promise<DisbursementStatus | null>;
  markPending(runId: string, employeeId: string): Promise<void>;
  markSubmitted(runId: string, employeeId: string, transferId: string): Promise<void>;
  markFailed(runId: string, employeeId: string, reason: string): Promise<void>;
}

export class TransientBankError extends Error {}
