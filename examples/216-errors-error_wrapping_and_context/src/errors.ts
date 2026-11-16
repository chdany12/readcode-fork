export type ErrorKind = "invalid_input" | "not_found" | "upstream_unavailable" | "internal";

export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly fields: Record<string, unknown> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

export function wrap(err: unknown, message: string, fields: Record<string, unknown> = {}): AppError {
  const kind = err instanceof AppError ? err.kind : "internal";
  return new AppError(kind, message, fields, { cause: err });
}

export function errorChain(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current !== undefined && depth < 8; depth++) {
    parts.push(current instanceof Error ? current.message : String(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(": ");
}

export function collectFields(err: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let current: unknown = err;
  for (let depth = 0; current instanceof Error && depth < 8; depth++) {
    if (current instanceof AppError) {
      for (const [k, v] of Object.entries(current.fields)) {
        if (!(k in out)) out[k] = v;
      }
    }
    current = current.cause;
  }
  return out;
}
