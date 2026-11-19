export interface LogRecord {
  [key: string]: unknown;
}

export interface Transport {
  send(line: string): void;
}

export class TelemetryLogger {
  constructor(
    private readonly transport: Transport,
    private readonly service: string,
    private readonly base: LogRecord = {},
  ) {}

  bind(extra: LogRecord): TelemetryLogger {
    return new TelemetryLogger(this.transport, this.service, { ...this.base, ...extra });
  }

  info(event: string, data: LogRecord = {}): void {
    this.out("info", event, data);
  }

  warn(event: string, data: LogRecord = {}): void {
    this.out("warn", event, data);
  }

  failure(event: string, err: Error, data: LogRecord = {}): void {
    this.out("error", event, {
      ...data,
      error: { ...err },
    });
  }

  private out(level: string, event: string, data: LogRecord): void {
    this.transport.send(
      JSON.stringify({
        ...this.base,
        ...data,
        "@timestamp": new Date().toISOString(),
        service: this.service,
        level,
        event,
      }),
    );
  }
}
