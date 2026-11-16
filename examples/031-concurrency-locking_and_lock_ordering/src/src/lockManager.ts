export class LockTimeoutError extends Error {
  constructor(readonly key: string, readonly waitedMs: number) {
    super(`timed out after ${waitedMs}ms waiting for ${key}`);
  }
}

interface Entry {
  held: boolean;
  waiters: Array<{ grant: () => void }>;
}

export class ResourceLockManager {
  private readonly entries = new Map<string, Entry>();

  private entry(key: string): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = { held: false, waiters: [] };
      this.entries.set(key, e);
    }
    return e;
  }

  private acquireOne(key: string, timeoutMs: number): Promise<void> {
    const e = this.entry(key);
    if (!e.held) {
      e.held = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        grant: () => {
          clearTimeout(timer);
          resolve();
        },
      };
      const timer = setTimeout(() => {
        const i = e.waiters.indexOf(waiter);
        if (i !== -1) {
          e.waiters.splice(i, 1);
          reject(new LockTimeoutError(key, timeoutMs));
        }
      }, timeoutMs);
      e.waiters.push(waiter);
    });
  }

  private releaseOne(key: string): void {
    const e = this.entries.get(key);
    if (!e || !e.held) return;
    const next = e.waiters.shift();
    if (next) {
      next.grant();
    } else {
      e.held = false;
      this.entries.delete(key);
    }
  }

  async withLocks<T>(keys: string[], timeoutMs: number, fn: () => Promise<T>): Promise<T> {
    const ordered = [...new Set(keys)].sort();
    const acquired: string[] = [];
    try {
      for (const k of ordered) {
        await this.acquireOne(k, timeoutMs);
        acquired.push(k);
      }
      return await fn();
    } finally {
      for (let i = acquired.length - 1; i >= 0; i--) this.releaseOne(acquired[i]);
    }
  }
}
