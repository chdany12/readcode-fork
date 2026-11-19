import { Pool } from "pg";

export interface ScanEvent {
  trackingNumber: string;
  facilityCode: string;
  status: "ARRIVED" | "DEPARTED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  scannedAt: Date;
}

export class ShipmentScanRepository {
  constructor(private readonly pool: Pool) {}

  async findShipmentStatus(trackingNumber: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      "SELECT status FROM shipments WHERE tracking_number = $1",
      [trackingNumber],
    );
    return rows[0]?.status ?? null;
  }

  async recordScan(event: ScanEvent): Promise<void> {
    const client = await this.pool.connect();
    await client.query("BEGIN");
    try {
      const { rowCount } = await client.query(
        `UPDATE shipments
            SET status = $2, last_facility = $3, updated_at = $4
          WHERE tracking_number = $1 AND updated_at <= $4`,
        [event.trackingNumber, event.status, event.facilityCode, event.scannedAt],
      );
      await client.query(
        `INSERT INTO scan_events (tracking_number, facility_code, status, scanned_at)
         VALUES ($1, $2, $3, $4)`,
        [event.trackingNumber, event.facilityCode, event.status, event.scannedAt],
      );
      if (rowCount === 0) {
        const exists = await client.query(
          "SELECT 1 FROM shipments WHERE tracking_number = $1",
          [event.trackingNumber],
        );
        if (exists.rowCount === 0) {
          throw new Error(`unknown shipment ${event.trackingNumber}`);
        }
      }
      await client.query("COMMIT");
      client.release();
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
}
