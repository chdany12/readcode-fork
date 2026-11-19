import { Pool } from "pg";

export interface ShipmentRow {
  id: string;
  trackingNumber: string;
  carrierCode: string;
  weightGrams: number;
  status: string;
}

export interface StopRow {
  shipmentId: string;
  sequence: number;
  facilityCode: string;
  scheduledAt: Date;
}

export interface CarrierRow {
  code: string;
  displayName: string;
  cutoffHourUtc: number;
}

export class ManifestRepository {
  constructor(private readonly pool: Pool) {}

  async shipmentsForDepot(depotId: string, shipDate: string): Promise<ShipmentRow[]> {
    const { rows } = await this.pool.query(
      `SELECT id, tracking_number AS "trackingNumber", carrier_code AS "carrierCode",
              weight_grams AS "weightGrams", status
         FROM shipments
        WHERE depot_id = $1 AND ship_date = $2 AND status <> 'cancelled'
        ORDER BY carrier_code, id`,
      [depotId, shipDate],
    );
    return rows;
  }

  async carriersByCode(codes: string[]): Promise<Map<string, CarrierRow>> {
    if (codes.length === 0) return new Map();
    const { rows } = await this.pool.query(
      `SELECT code, display_name AS "displayName", cutoff_hour_utc AS "cutoffHourUtc"
         FROM carriers WHERE code = ANY($1)`,
      [codes],
    );
    return new Map(rows.map((r: CarrierRow) => [r.code, r]));
  }

  async stopsForShipment(shipmentId: string): Promise<StopRow[]> {
    const { rows } = await this.pool.query(
      `SELECT shipment_id AS "shipmentId", sequence, facility_code AS "facilityCode",
              scheduled_at AS "scheduledAt"
         FROM shipment_stops WHERE shipment_id = $1 ORDER BY sequence`,
      [shipmentId],
    );
    return rows;
  }

  async stopsForShipments(shipmentIds: string[]): Promise<Map<string, StopRow[]>> {
    const out = new Map<string, StopRow[]>();
    if (shipmentIds.length === 0) return out;
    const { rows } = await this.pool.query(
      `SELECT shipment_id AS "shipmentId", sequence, facility_code AS "facilityCode",
              scheduled_at AS "scheduledAt"
         FROM shipment_stops WHERE shipment_id = ANY($1) ORDER BY shipment_id, sequence`,
      [shipmentIds],
    );
    for (const r of rows as StopRow[]) {
      const list = out.get(r.shipmentId) ?? [];
      list.push(r);
      out.set(r.shipmentId, list);
    }
    return out;
  }
}
