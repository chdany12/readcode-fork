import { Pool } from "pg";
import { KeyRing, SealedReading, openReading, sealReading } from "./readingCrypto";

export interface TelemetryReading {
  deviceId: string;
  recordedAt: Date;
  gps?: { lat: number; lon: number };
  batteryPct: number;
  sensors: Record<string, number>;
}

export class TelemetryStore {
  constructor(private readonly db: Pool, private readonly ring: KeyRing) {}

  async append(reading: TelemetryReading): Promise<void> {
    const sealed = sealReading(this.ring, reading.deviceId, {
      gps: reading.gps ?? null,
      batteryPct: reading.batteryPct,
      sensors: reading.sensors,
    });
    await this.db.query(
      "INSERT INTO telemetry (device_id, recorded_at, key_id, sealed) VALUES ($1, $2, $3, $4)",
      [reading.deviceId, reading.recordedAt, sealed.keyId, JSON.stringify(sealed)],
    );
  }

  async recent(deviceId: string, limit = 100): Promise<TelemetryReading[]> {
    const { rows } = await this.db.query(
      "SELECT recorded_at, sealed FROM telemetry WHERE device_id = $1 ORDER BY recorded_at DESC LIMIT $2",
      [deviceId, Math.min(Math.max(limit, 1), 1000)],
    );
    return rows.map((row) => {
      const body = openReading(this.ring, deviceId, JSON.parse(row.sealed) as SealedReading) as Omit<
        TelemetryReading,
        "deviceId" | "recordedAt"
      > & { gps: TelemetryReading["gps"] | null };
      return {
        deviceId,
        recordedAt: row.recorded_at,
        gps: body.gps ?? undefined,
        batteryPct: body.batteryPct,
        sensors: body.sensors,
      };
    });
  }

  async rewrapOlderThan(cutoff: Date, batchSize = 500): Promise<number> {
    const { rows } = await this.db.query(
      "SELECT id, device_id, sealed FROM telemetry WHERE key_id <> $1 AND recorded_at < $2 LIMIT $3",
      [this.ring.activeKeyId, cutoff, batchSize],
    );
    for (const row of rows) {
      const body = openReading(this.ring, row.device_id, JSON.parse(row.sealed) as SealedReading) as object;
      const resealed = sealReading(this.ring, row.device_id, body);
      await this.db.query("UPDATE telemetry SET key_id = $1, sealed = $2 WHERE id = $3", [
        resealed.keyId,
        JSON.stringify(resealed),
        row.id,
      ]);
    }
    return rows.length;
  }
}
