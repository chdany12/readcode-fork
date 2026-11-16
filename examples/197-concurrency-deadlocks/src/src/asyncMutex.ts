export class AsyncMutex {
  private locked = false;
  private waiters: Array<() => void> = [];

  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    return () => this.release();
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

export class KeyedMutex {
  private locks = new Map<string, AsyncMutex>();

  forKey(key: string): AsyncMutex {
    let m = this.locks.get(key);
    if (!m) {
      m = new AsyncMutex();
      this.locks.set(key, m);
    }
    return m;
  }
}
