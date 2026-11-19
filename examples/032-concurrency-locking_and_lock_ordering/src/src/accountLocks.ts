export class AccountLock {
  private locked = false;
  private readonly queue: Array<() => void> = [];

  acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.locked = false;
  }
}

export class AccountLockTable {
  private readonly table = new Map<string, AccountLock>();

  get(accountId: string): AccountLock {
    let l = this.table.get(accountId);
    if (!l) {
      l = new AccountLock();
      this.table.set(accountId, l);
    }
    return l;
  }
}
