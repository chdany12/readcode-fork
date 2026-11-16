export class QueueFullError extends Error {
  constructor(readonly queued: number) {
    super(`courier api queue full (${queued} waiting)`);
    this.name = "QueueFullError";
  }
}

interface Waiter {
  run: () => void;
}

export class PacedExecutor {
  private readonly waiting: Waiter[] = [];
  private nextSlotAt = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly minIntervalMs: number,
    private readonly maxQueue: number,
  ) {}

  submit<T>(task: () => Promise<T>): Promise<T> {
    if (this.waiting.length >= this.maxQueue) {
      return Promise.reject(new QueueFullError(this.waiting.length));
    }
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        run: () => {
          task().then(resolve, reject);
        },
      });
      this.pump();
    });
  }

  private pump() {
    if (this.timer || this.waiting.length === 0) return;
    const delay = Math.max(0, this.nextSlotAt - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.waiting.shift();
      if (next) {
        this.nextSlotAt = Date.now() + this.minIntervalMs;
        try {
          next.run();
        } finally {
          this.pump();
        }
      }
    }, delay);
  }
}
