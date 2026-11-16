type Waiter = () => void;

export class KeyedMutex {
  private readonly held = new Set<string>();
  private readonly queues = new Map<string, Waiter[]>();

  private async lock(key: string): Promise<void> {
    if (!this.held.has(key)) {
      this.held.add(key);
      return;
    }
    await new Promise<void>((resolve) => {
      const q = this.queues.get(key) ?? [];
      q.push(resolve);
      this.queues.set(key, q);
    });
  }

  private unlock(key: string): void {
    const q = this.queues.get(key);
    const next = q?.shift();
    if (q && q.length === 0) this.queues.delete(key);
    if (next) {
      next();
    } else {
      this.held.delete(key);
    }
  }

  async runExclusive<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
    const ordered = Array.from(new Set(keys)).sort();
    const taken: string[] = [];
    try {
      for (const key of ordered) {
        await this.lock(key);
        taken.push(key);
      }
      return await fn();
    } finally {
      while (taken.length > 0) this.unlock(taken.pop()!);
    }
  }
}
