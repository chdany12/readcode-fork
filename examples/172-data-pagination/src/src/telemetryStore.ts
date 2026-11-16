import type { Pool } from "pg";

export interface Reading {
  deviceId: string;
  metric: string;
  value: number;
  recordedAt: Date;
}

export interface ReadingPage {
  readings: Reading[];
  nextToken: string | null;
}

export class TelemetryStore {
  constructor(private readonly db: Pool) {}

  async readingsSince(
    deviceId: string,
    from: Date,
    to: Date,
    pageSize: number,
    pageToken?: string,
  ): Promise<ReadingPage> {
    const size = Math.min(Math.max(pageSize, 1), 1000);
    const after = pageToken ? new Date(Number(Buffer.from(pageToken, "base64url").toString())) : from;
    if (Number.isNaN(after.getTime())) throw new Error("invalid page token");
    const op = pageToken ? ">" : ">=";

    const { rows } = await this.db.query(
      `SELECT device_id, metric, value, recorded_at
         FROM readings
        WHERE device_id = $1
          AND recorded_at ${op} $2
          AND recorded_at < $3
        ORDER BY recorded_at ASC
        LIMIT $4`,
      [deviceId, after, to, size],
    );

    const readings: Reading[] = rows.map((r) => ({
      deviceId: r.device_id,
      metric: r.metric,
      value: Number(r.value),
      recordedAt: new Date(r.recorded_at),
    }));

    const last = readings[readings.length - 1];
    const nextToken =
      readings.length === size && last
        ? Buffer.from(String(last.recordedAt.getTime())).toString("base64url")
        : null;

    return { readings, nextToken };
  }
}
