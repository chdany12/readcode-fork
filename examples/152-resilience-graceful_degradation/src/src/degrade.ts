export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
  }
}

export async function withTimeout<T>(label: string, ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(label, ms)), ms);
  try {
    return await Promise.race([
      fn(ctrl.signal),
      new Promise<never>((_, reject) =>
        ctrl.signal.addEventListener("abort", () => reject(ctrl.signal.reason), { once: true }),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function optional<T>(
  label: string,
  ms: number,
  fallback: T,
  fn: (signal: AbortSignal) => Promise<T>,
  onDegraded: (label: string, err: unknown) => void,
): Promise<{ value: T; degraded: boolean }> {
  try {
    return { value: await withTimeout(label, ms, fn), degraded: false };
  } catch (err) {
    onDegraded(label, err);
    return { value: fallback, degraded: true };
  }
}
