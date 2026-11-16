export type Fields = Record<string, unknown>;

export interface Sink {
  write(line: string): void;
}

const REDACTED_KEYS = new Set(["password", "token", "refreshToken", "otp", "authorization"]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Fields = {};
  for (const [k, v] of Object.entries(value as Fields)) {
    out[k] = REDACTED_KEYS.has(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

export function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return { type: err.name, message: err.message, stack: err.stack };
  }
  return { type: typeof err, message: String(err) };
}

export class JsonLogger {
  constructor(
    private readonly sink: Sink,
    private readonly bindings: Fields = {},
  ) {}

  with(fields: Fields): JsonLogger {
    return new JsonLogger(this.sink, { ...this.bindings, ...fields });
  }

  info(event: string, fields: Fields = {}): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields: Fields = {}): void {
    this.write("warn", event, fields);
  }

  error(event: string, err: unknown, fields: Fields = {}): void {
    this.write("error", event, { ...fields, err: serializeError(err) });
  }

  private write(level: string, event: string, fields: Fields): void {
    const record = redact({ ...this.bindings, ...fields }) as Fields;
    this.sink.write(
      JSON.stringify({ ...record, time: new Date().toISOString(), level, event }),
    );
  }
}
