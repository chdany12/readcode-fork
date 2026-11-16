export interface FlagSnapshot {
  version: number;
  flags: Record<string, boolean>;
}

export interface FlagSource {
  fetch(): Promise<FlagSnapshot>;
}

export interface Logger {
  warn(msg: string, fields?: Record<string, unknown>): void;
}

export class GameFlags {
  private snapshot: FlagSnapshot = { version: 0, flags: {} };
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly source: FlagSource,
    private readonly log: Logger,
    private readonly refreshMs = 15_000,
  ) {}

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.refreshMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    try {
      const next = await this.source.fetch();
      if (next.version >= this.snapshot.version) {
        this.snapshot = next;
      }
    } catch (err) {
      this.log.warn("flag refresh failed, keeping last snapshot", {
        version: this.snapshot.version,
        error: String(err),
      });
    }
  }

  isOn(name: string): boolean {
    return this.snapshot.flags[name] ?? true;
  }

  currentVersion(): number {
    return this.snapshot.version;
  }
}
