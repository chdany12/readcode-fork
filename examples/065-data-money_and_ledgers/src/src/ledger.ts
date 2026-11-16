export type AccountCode = "customer_receivable" | "compute_revenue" | "promo_credits" | "refunds_payable";

export interface LedgerLine {
  account: AccountCode;
  orgId: string;
  amountMicros: bigint; // positive = debit, negative = credit
}

export interface LedgerTxn {
  txnId: string;
  orgId: string;
  kind: "usage_charge" | "credit_grant" | "reversal";
  reversesTxnId?: string;
  lines: LedgerLine[];
  postedAt: Date;
}

export interface LedgerRepo {
  getTxn(txnId: string): Promise<LedgerTxn | null>;
  findReversalOf(txnId: string): Promise<LedgerTxn | null>;
  insert(txn: LedgerTxn): Promise<void>;
}

export function sumLines(lines: LedgerLine[]): bigint {
  return lines.reduce((acc, l) => acc + l.amountMicros, 0n);
}
