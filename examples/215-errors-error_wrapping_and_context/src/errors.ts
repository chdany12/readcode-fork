export class IndexingError extends Error {
  constructor(
    message: string,
    readonly context: Record<string, string | number>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "IndexingError";
  }
}

export class SearchClusterError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "SearchClusterError";
  }
}

export function rootCause(err: unknown): unknown {
  let current = err;
  const seen = new Set<unknown>();
  while (current instanceof Error && current.cause !== undefined && !seen.has(current)) {
    seen.add(current);
    current = current.cause;
  }
  return current;
}

export function isRetryable(err: unknown): boolean {
  const root = rootCause(err);
  if (root instanceof SearchClusterError) {
    return root.statusCode === 429 || root.statusCode >= 500;
  }
  if (root instanceof Error && "code" in root) {
    const code = (root as NodeJS.ErrnoException).code;
    return code === "ECONNRESET" || code === "ETIMEDOUT";
  }
  return false;
}
