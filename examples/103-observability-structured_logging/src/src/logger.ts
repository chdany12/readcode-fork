export type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Fields = Record<string, unknown>;

export interface Sink {
  write(line: string): void;
}

export class Logger {
  constructor(
    private readonly sink: Sink,
    private readonly minLevel: Level,
    private readonly bindings: Fields = {},
  ) {}

  child(fields: Fields): Logger {
    const merged = Object.assign(this.bindings, fields);
    return new Logger(this.sink, this.minLevel, merged);
  }

  debug(msg: string, fields?: Fields) { this.log("debug", msg, fields); }
  info(msg: string, fields?: Fields) { this.log("info", msg, fields); }
  warn(msg: string, fields?: Fields) { this.log("warn", msg, fields); }

  error(msg: string, err: unknown, fields?: Fields) {
    const errFields =
      err instanceof Error
        ? { "error.type": err.name, "error.message": err.message, "error.stack": err.stack }
        : { "error.message": String(err) };
    this.log("error", msg, { ...errFields, ...fields });
  }

  private log(level: Level, msg: string, fields?: Fields) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const record = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...this.bindings,
      ...fields,
    };
    this.sink.write(JSON.stringify(record));
  }
}

export const rootLogger = new Logger(
  { write: (line) => process.stdout.write(line + "\n") },
  (process.env.LOG_LEVEL as Level) ?? "info",
  { service: "booking-api", env: process.env.NODE_ENV ?? "development" },
);
