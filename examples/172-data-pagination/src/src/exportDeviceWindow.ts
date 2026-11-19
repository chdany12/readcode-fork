import { TelemetryStore, type Reading } from "./telemetryStore";

export interface ExportSink {
  write(batch: Reading[]): Promise<void>;
}

export interface ExportSummary {
  deviceId: string;
  pages: number;
  rows: number;
}

export async function exportDeviceWindow(
  store: TelemetryStore,
  sink: ExportSink,
  deviceId: string,
  from: Date,
  to: Date,
  signal?: AbortSignal,
): Promise<ExportSummary> {
  let token: string | undefined;
  let pages = 0;
  let rows = 0;

  do {
    if (signal?.aborted) throw new Error(`export of ${deviceId} aborted after ${rows} rows`);
    const page = await store.readingsSince(deviceId, from, to, 500, token);
    if (page.readings.length > 0) {
      await sink.write(page.readings);
      rows += page.readings.length;
    }
    pages++;
    token = page.nextToken ?? undefined;
  } while (token);

  return { deviceId, pages, rows };
}
