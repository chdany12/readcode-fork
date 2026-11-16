export class EnvironmentLock {
  private held = false;
  private holder: string | null = null;
  private readonly waiters: Array<() => void> = [];

  async acquire(owner: string): Promise<void> {
    while (this.held) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.held = true;
    this.holder = owner;
  }

  release(owner: string): void {
    if (!this.held || this.holder !== owner) {
      throw new Error(`lock not held by ${owner}`);
    }
    this.held = false;
    this.holder = null;
    const next = this.waiters.shift();
    if (next) next();
  }

  currentHolder(): string | null {
    return this.holder;
  }
}
