import { TelemetryFlagClient, DeviceContext } from "./flagClient";

export interface Reading {
  deviceId: string;
  firmware: string;
  metric: string;
  value: number;
  ts: number;
}

export interface Sink {
  write(batch: Reading[]): Promise<void>;
}

export class ReadingIngestor {
  constructor(
    private readonly flags: TelemetryFlagClient,
    private readonly rawSink: Sink,
    private readonly compactSink: Sink,
  ) {}

  async ingest(readings: Reading[]): Promise<void> {
    const raw: Reading[] = [];
    const compact: Reading[] = [];
    for (const r of readings) {
      const device: DeviceContext = { deviceId: r.deviceId, firmware: r.firmware };
      if (this.flags.isEnabled("compact-telemetry-path", device)) compact.push(r);
      else raw.push(r);
    }
    await Promise.all([
      raw.length ? this.rawSink.write(raw) : Promise.resolve(),
      compact.length ? this.compactSink.write(compact) : Promise.resolve(),
    ]);
  }
}
