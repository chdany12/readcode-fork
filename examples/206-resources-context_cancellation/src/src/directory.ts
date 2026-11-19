export class DirectoryError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

export interface DirectoryClient {
  fetchGroups(userId: string, opts: { signal: AbortSignal }): Promise<string[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function groupsWithRetry(
  client: DirectoryClient,
  userId: string,
  signal: AbortSignal,
  attempts = 4,
): Promise<string[]> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.fetchGroups(userId, { signal });
    } catch (err) {
      lastErr = err;
      if (err instanceof DirectoryError && !err.retryable) throw err;
      await sleep(100 * 2 ** i);
    }
  }
  throw lastErr;
}
