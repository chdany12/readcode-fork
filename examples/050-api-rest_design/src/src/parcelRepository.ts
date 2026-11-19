import { Pool } from "pg";

export interface Parcel {
  id: string;
  shipmentId: string;
  weightGrams: number;
  trackingNumber: string | null;
  status: "pending" | "labelled" | "in_transit" | "delivered";
}

export class ParcelRepository {
  constructor(private readonly pool: Pool) {}

  async shipmentExists(shipmentId: string, merchantId: string): Promise<boolean> {
    const r = await this.pool.query(
      "SELECT 1 FROM shipments WHERE id = $1 AND merchant_id = $2",
      [shipmentId, merchantId]
    );
    return r.rowCount === 1;
  }

  async listByShipment(shipmentId: string): Promise<Parcel[]> {
    const r = await this.pool.query(
      "SELECT id, shipment_id, weight_grams, tracking_number, status FROM parcels WHERE shipment_id = $1 ORDER BY id",
      [shipmentId]
    );
    return r.rows.map(toParcel);
  }

  async findById(parcelId: string): Promise<Parcel | null> {
    const r = await this.pool.query(
      "SELECT id, shipment_id, weight_grams, tracking_number, status FROM parcels WHERE id = $1",
      [parcelId]
    );
    return r.rowCount ? toParcel(r.rows[0]) : null;
  }

  async insert(shipmentId: string, weightGrams: number): Promise<Parcel> {
    const r = await this.pool.query(
      "INSERT INTO parcels (shipment_id, weight_grams, status) VALUES ($1, $2, 'pending') RETURNING *",
      [shipmentId, weightGrams]
    );
    return toParcel(r.rows[0]);
  }

  async deletePending(parcelId: string): Promise<boolean> {
    const r = await this.pool.query(
      "DELETE FROM parcels WHERE id = $1 AND status = 'pending'",
      [parcelId]
    );
    return r.rowCount === 1;
  }
}

function toParcel(row: any): Parcel {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    weightGrams: row.weight_grams,
    trackingNumber: row.tracking_number,
    status: row.status,
  };
}
