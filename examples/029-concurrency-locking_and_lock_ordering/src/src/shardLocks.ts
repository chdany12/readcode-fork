export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const prev = this.tail;
    this.tail = prev.then(() => next);
    await prev;
    return release;
  }
}

export class ShardLocks {
  private readonly locks = new Map<string, AsyncMutex>();

  private lockFor(shardId: string): AsyncMutex {
    let m = this.locks.get(shardId);
    if (!m) {
      m = new AsyncMutex();
      this.locks.set(shardId, m);
    }
    return m;
  }

  async withShard<T>(shardId: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.lockFor(shardId).acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async withShards<T>(shardIds: string[], fn: () => Promise<T>): Promise<T> {
    const ordered = [...new Set(shardIds)].sort();
    const releases: Array<() => void> = [];
    try {
      for (const id of ordered) {
        releases.push(await this.lockFor(id).acquire());
      }
      return await fn();
    } finally {
      for (const r of releases.reverse()) r();
    }
  }
}
