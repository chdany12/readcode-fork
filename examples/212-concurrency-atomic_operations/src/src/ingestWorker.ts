import { parentPort, workerData } from "worker_threads";
import { IngestStats } from "./ingestStats";

interface TelemetryFrame {
  deviceId: string;
  ts: number;
  readings: Record<string, number>;
}

const stats = new IngestStats(workerData.statsBuffer as SharedArrayBuffer);

function decode(raw: Buffer): TelemetryFrame | null {
  try {
    const frame = JSON.parse(raw.toString("utf8"));
    if (typeof frame.deviceId !== "string" || typeof frame.ts !== "number") return null;
    if (typeof frame.readings !== "object" || frame.readings === null) return null;
    return frame as TelemetryFrame;
  } catch {
    return null;
  }
}

parentPort!.on("message", (raw: Buffer) => {
  stats.begin();
  try {
    const frame = decode(raw);
    if (!frame) {
      stats.rejected();
      return;
    }
    parentPort!.postMessage({ type: "frame", frame });
    stats.accepted(raw.byteLength);
  } finally {
    stats.end();
  }
});
