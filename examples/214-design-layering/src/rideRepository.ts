import { Pool } from "pg";

export type RideStatus = "requested" | "assigned" | "in_progress" | "completed" | "cancelled";

export interface Ride {
  id: string;
  riderId: string;
  driverId: string | null;
  status: RideStatus;
  requestedAt: Date;
}

interface RideRow {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: RideStatus;
  requested_at: Date;
}

function toRide(row: RideRow): Ride {
  return {
    id: row.id,
    riderId: row.rider_id,
    driverId: row.driver_id,
    status: row.status,
    requestedAt: row.requested_at,
  };
}

export class RideRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Ride | null> {
    const { rows } = await this.pool.query<RideRow>(
      "SELECT id, rider_id, driver_id, status, requested_at FROM rides WHERE id = $1",
      [id],
    );
    return (rows[0] as unknown as Ride) ?? null;
  }

  async findActiveForRider(riderId: string): Promise<Ride | null> {
    const { rows } = await this.pool.query<RideRow>(
      `SELECT id, rider_id, driver_id, status, requested_at FROM rides
       WHERE rider_id = $1 AND status IN ('requested', 'assigned', 'in_progress')
       LIMIT 1`,
      [riderId],
    );
    return rows[0] ? toRide(rows[0]) : null;
  }

  async create(riderId: string): Promise<Ride> {
    const { rows } = await this.pool.query<RideRow>(
      `INSERT INTO rides (rider_id, status, requested_at) VALUES ($1, 'requested', now())
       RETURNING id, rider_id, driver_id, status, requested_at`,
      [riderId],
    );
    return toRide(rows[0]);
  }

  async setStatus(id: string, status: RideStatus): Promise<void> {
    await this.pool.query("UPDATE rides SET status = $1 WHERE id = $2", [status, id]);
  }
}
