import { createHash } from "crypto";

export interface PayrollAuditEvent {
  seq: number;
  occurredAt: string;
  actorUserId: string;
  employeeId: string;
  field: "baseSalary" | "bankAccount" | "taxCode" | "payGrade";
  oldValue: string;
  newValue: string;
  reason: string;
  sourceIp: string;
}

export interface AuditStore {
  insert(event: PayrollAuditEvent): Promise<void>;
  nextSeq(): Promise<number>;
}

export function maskAccount(value: string): string {
  if (value.length <= 4) return "****";
  return "*".repeat(value.length - 4) + value.slice(-4);
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export class PayrollAuditTrail {
  constructor(private readonly store: AuditStore) {}

  async write(event: Omit<PayrollAuditEvent, "seq" | "occurredAt">): Promise<void> {
    const seq = await this.store.nextSeq();
    const safe = { ...event };
    if (event.field === "bankAccount") {
      safe.oldValue = `${maskAccount(event.oldValue)}#${fingerprint(event.oldValue)}`;
      safe.newValue = `${maskAccount(event.newValue)}#${fingerprint(event.newValue)}`;
    }
    await this.store.insert({ ...safe, seq, occurredAt: new Date().toISOString() });
  }
}
