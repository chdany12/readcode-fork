export class BoundedQueue<T> {
  private readonly items: T[] = [];
  private readonly waitingPutters: (() => void)[] = [];
  private readonly waitingTakers: ((item: T) => void)[] = [];

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.items.length;
  }

  async put(item: T): Promise<void> {
    while (this.items.length >= this.capacity) {
      await new Promise<void>((resolve) => this.waitingPutters.push(resolve));
    }
    const taker = this.waitingTakers.shift();
    if (taker) {
      taker(item);
      return;
    }
    this.items.push(item);
  }

  async take(): Promise<T> {
    const item = this.items.shift();
    if (item !== undefined) {
      this.waitingPutters.shift()?.();
      return item;
    }
    return new Promise<T>((resolve) => this.waitingTakers.push(resolve));
  }
}
