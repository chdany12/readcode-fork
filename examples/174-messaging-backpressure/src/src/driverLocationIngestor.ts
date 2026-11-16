import { BoundedQueue } from "./boundedQueue";

export interface DriverPing {
  driverId: string;
  lat: number;
  lng: number;
  recordedAt: number;
}

export interface PingStream {
  [Symbol.asyncIterator](): AsyncIterator<DriverPing>;
}

export interface GeoIndex {
  upsertMany(pings: DriverPing[]): Promise<void>;
}

export interface Logger {
  warn(msg: string, fields: Record<string, unknown>): void;
}

export class DriverLocationIngestor {
  private readonly queue: BoundedQueue<DriverPing>;
  private stopped = false;

  constructor(
    private readonly geo: GeoIndex,
    private readonly log: Logger,
    private readonly batchSize = 200,
    capacity = 5000,
  ) {
    this.queue = new BoundedQueue<DriverPing>(capacity);
  }

  async readFrom(stream: PingStream): Promise<void> {
    for await (const ping of stream) {
      if (this.stopped) break;
      if (Date.now() - ping.recordedAt > 30_000) continue;
      this.queue.put(ping).catch((err) =>
        this.log.warn("enqueue failed", { driverId: ping.driverId, err: String(err) }),
      );
    }
  }

  async runWriter(): Promise<void> {
    while (!this.stopped) {
      const batch: DriverPing[] = [await this.queue.take()];
      while (batch.length < this.batchSize && this.queue.size > 0) {
        batch.push(await this.queue.take());
      }
      try {
        await this.geo.upsertMany(dedupeLatest(batch));
      } catch (err) {
        this.log.warn("geo upsert failed", { count: batch.length, err: String(err) });
      }
    }
  }

  stop(): void {
    this.stopped = true;
  }
}

function dedupeLatest(pings: DriverPing[]): DriverPing[] {
  const latest = new Map<string, DriverPing>();
  for (const p of pings) {
    const prev = latest.get(p.driverId);
    if (!prev || prev.recordedAt < p.recordedAt) latest.set(p.driverId, p);
  }
  return [...latest.values()];
}
