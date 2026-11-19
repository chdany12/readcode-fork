export interface Reading {
  deviceId: string;
  metric: string;
  value: number;
  recordedAt: string;
}

const METRICS = new Set(["temp_c", "humidity_pct", "battery_v", "rssi_dbm"]);

export function normalizeReading(input: unknown): Reading | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;

  const deviceId = typeof r.device_id === "string" ? r.device_id.trim() : "";
  const metric = typeof r.metric === "string" ? r.metric.toLowerCase() : "";
  const value = typeof r.value === "number" ? r.value : Number(r.value);
  const ts = typeof r.ts === "number" ? new Date(r.ts * 1000) : new Date(String(r.ts));

  if (!deviceId || !METRICS.has(metric)) return null;
  if (!Number.isFinite(value)) return null;
  if (Number.isNaN(ts.getTime())) return null;

  return { deviceId, metric, value, recordedAt: ts.toISOString() };
}
