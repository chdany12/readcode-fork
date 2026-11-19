export type Task<T> = () => Promise<T>;

interface Pending<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export class BoundedPool {
  private active = 0;
  private readonly queue: Pending<any>[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxQueued: number,
  ) {
    if (concurrency < 1) throw new Error("concurrency must be >= 1");
  }

  get stats() {
    return { active: this.active, queued: this.queue.length };
  }

  submit<T>(task: Task<T>): Promise<T> {
    if (this.queue.length >= this.maxQueued) {
      return Promise.reject(new PoolSaturatedError(this.queue.length));
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.active++;
      this.run(job);
    }
  }

  private async run<T>(job: Pending<T>): Promise<void> {
    try {
      const value = await job.task();
      this.active--;
      job.resolve(value);
    } catch (err) {
      job.reject(err);
    }
    this.drain();
  }
}

export class PoolSaturatedError extends Error {
  constructor(public readonly queued: number) {
    super(`worker pool saturated (${queued} queued)`);
    this.name = "PoolSaturatedError";
  }
}
