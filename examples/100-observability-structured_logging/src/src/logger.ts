export type Level = "debug" | "info" | "warn" | "error";

export interface LogSink {
  write(line: string): void;
}

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
  constructor(
    private readonly sink: LogSink,
    private readonly context: Record<string, unknown> = {},
    private readonly minLevel: Level = "info",
  ) {}

  child(fields: Record<string, unknown>): Logger {
    return new Logger(this.sink, Object.assign(this.context, fields), this.minLevel);
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.emit("debug", msg, fields);
  }

  info(msg: string, fields?: Record<string, unknown>): void {
    this.emit("info", msg, fields);
  }

  warn(msg: string, fields?: Record<string, unknown>): void {
    this.emit("warn", msg, fields);
  }

  error(msg: string, fields?: Record<string, unknown>): void {
    this.emit("error", msg, fields);
  }

  private emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const record = {
      ...this.context,
      ...fields,
      ts: new Date().toISOString(),
      level,
      msg,
    };
    this.sink.write(JSON.stringify(record));
  }
}
