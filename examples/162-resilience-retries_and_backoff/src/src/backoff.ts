export interface Backoff { initialMs: number; multiplier: number; capMs: number; maxRetries: number }

export const DEFAULT_BACKOFF: Backoff = { initialMs: 200, multiplier: 2, capMs: 5_000, maxRetries: 4 };

export function delayFor(retry: number, b: Backoff): number {
  const exp = Math.min(b.capMs, b.initialMs * Math.pow(b.multiplier, retry));
  return exp / 2 + Math.random() * (exp / 2);
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
