import { TelemetryLogger } from "./telemetryLogger";

export interface Reading {
  deviceId: string;
  sensor: string;
  value: number;
  recordedAt: number;
}

export interface TimeSeriesWriter {
  writeBatch(points: Reading[]): Promise<void>;
}

export class ReadingIngestor {
  private buffer: Reading[] = [];
  private flushing = false;

  constructor(
    private readonly writer: TimeSeriesWriter,
    private readonly log: TelemetryLogger,
    private readonly maxBatch = 500,
  ) {}

  accept(gatewayId: string, readings: Reading[]): number {
    const glog = this.log.bind({ gatewayId });
    let dropped = 0;
    for (const r of readings) {
      if (!Number.isFinite(r.value) || r.recordedAt > Date.now() + 60_000) {
        dropped++;
        continue;
      }
      this.buffer.push(r);
    }
    if (dropped > 0) {
      glog.warn("readings.dropped", { dropped, received: readings.length });
    }
    return readings.length - dropped;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.maxBatch);
    const started = Date.now();
    try {
      await this.writer.writeBatch(batch);
      this.log.info("readings.flushed", {
        count: batch.length,
        devices: new Set(batch.map((r) => r.deviceId)).size,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      this.buffer.unshift(...batch);
      this.log.failure("readings.flush_failed", err as Error, {
        count: batch.length,
        pending: this.buffer.length,
        durationMs: Date.now() - started,
      });
    } finally {
      this.flushing = false;
    }
  }
}
