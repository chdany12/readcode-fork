import { createHash } from "crypto";

export interface LedgerAuditRecord {
  index: number;
  recordedAt: string;
  operatorId: string;
  operation: "refund.issued" | "invoice.voided" | "credit.applied";
  accountId: string;
  amountCents: number;
  currency: string;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

export function computeHash(r: Omit<LedgerAuditRecord, "hash">): string {
  const canonical = [
    r.index,
    r.recordedAt,
    r.operatorId,
    r.operation,
    r.accountId,
    r.currency,
    r.prevHash,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function verifyChain(records: LedgerAuditRecord[]): { ok: true } | { ok: false; brokenAt: number } {
  let prev = GENESIS_HASH;
  for (const r of records) {
    const { hash, ...rest } = r;
    if (r.prevHash !== prev || computeHash(rest) !== hash) {
      return { ok: false, brokenAt: r.index };
    }
    prev = hash;
  }
  return { ok: true };
}
