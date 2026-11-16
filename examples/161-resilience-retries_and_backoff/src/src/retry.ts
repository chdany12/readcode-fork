export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly retryAfterMs?: number, message?: string) {
    super(message ?? `HTTP ${status}`);
  }
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
  return err instanceof TypeError;
}

export function backoffDelay(attempt: number, policy: RetryPolicy, random: () => number = Math.random): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(random() * ceiling);
}

export async function withRetry<T>(
  op: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op(attempt);
    } catch (err) {
      if (attempt >= policy.maxAttempts || !isRetryable(err)) throw err;
      const jittered = backoffDelay(attempt, policy);
      const hinted = err instanceof HttpError && err.retryAfterMs !== undefined
        ? Math.min(err.retryAfterMs, policy.maxDelayMs)
        : 0;
      await sleep(Math.max(jittered, hinted));
    }
  }
}
