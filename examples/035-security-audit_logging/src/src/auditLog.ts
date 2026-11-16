import { createHash } from "node:crypto";

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  resource: string;
  outcome: "allowed" | "denied" | "failed";
  details: Record<string, unknown>;
}

export interface AuditSink {
  append(line: string): Promise<void>;
}

export class AuditLog {
  private lastHash = "genesis";

  constructor(private readonly sink: AuditSink) {}

  async record(event: Omit<AuditEvent, "at">): Promise<void> {
    const entry = { ...event, at: new Date().toISOString(), prev: this.lastHash };
    const serialized = JSON.stringify(entry);
    const hash = createHash("sha256").update(serialized).digest("hex");
    await this.sink.append(JSON.stringify({ ...entry, hash }));
    this.lastHash = hash;
  }
}
