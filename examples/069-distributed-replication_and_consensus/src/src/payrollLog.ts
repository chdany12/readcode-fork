export interface LogEntry {
  term: number;
  kind: "payroll_run" | "salary_change" | "bonus";
  employeeId: string;
  amountCents: number;
  payPeriod: string;
}

export class PayrollLog {
  private entries: LogEntry[] = [];
  lastApplied = 0;

  entryAt(index: number): LogEntry | undefined {
    if (index < 1) return undefined;
    return this.entries[index - 1];
  }

  lastIndex(): number {
    return this.entries.length;
  }

  lastEntry(): LogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  append(entry: LogEntry): void {
    this.entries.push(entry);
  }

  truncateFrom(index: number): void {
    if (index <= this.lastApplied) {
      throw new Error(`refusing to truncate applied entry ${index}`);
    }
    this.entries = this.entries.slice(0, index - 1);
  }
}
