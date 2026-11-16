import { Pool } from "pg";

export interface Device {
  id: string;
  siteId: string;
  model: string;
  firmware: string;
}

export interface Site {
  id: string;
  name: string;
  timezone: string;
}

export interface LatestReading {
  deviceId: string;
  recordedAt: Date;
  temperatureC: number;
  batteryPct: number;
}

export class FleetRepository {
  constructor(private readonly pool: Pool) {}

  async devicesForAccount(accountId: string): Promise<Device[]> {
    const { rows } = await this.pool.query(
      `SELECT id, site_id AS "siteId", model, firmware_version AS firmware
         FROM devices WHERE account_id = $1 AND decommissioned_at IS NULL`,
      [accountId],
    );
    return rows;
  }

  async latestReadings(deviceIds: string[]): Promise<Map<string, LatestReading>> {
    if (deviceIds.length === 0) return new Map();
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (device_id) device_id AS "deviceId", recorded_at AS "recordedAt",
              temperature_c AS "temperatureC", battery_pct AS "batteryPct"
         FROM readings
        WHERE device_id = ANY($1) AND recorded_at > now() - interval '24 hours'
        ORDER BY device_id, recorded_at DESC`,
      [deviceIds],
    );
    return new Map(rows.map((r: LatestReading) => [r.deviceId, r]));
  }

  async siteById(siteId: string): Promise<Site | null> {
    const { rows } = await this.pool.query(
      `SELECT id, name, timezone FROM sites WHERE id = $1`,
      [siteId],
    );
    return rows[0] ?? null;
  }
}
