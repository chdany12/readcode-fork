import { EventEmitter } from "events";

export interface Driver {
  id: string;
  lat: number;
  lng: number;
  available: boolean;
}

export interface DriverLocator {
  nearby(lat: number, lng: number, radiusKm: number): Promise<Driver[]>;
}

export interface RideRequest {
  rideId: string;
  riderId: string;
  pickupLat: number;
  pickupLng: number;
}

export type Assignment = { rideId: string; driverId: string; distanceKm: number };

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class Dispatcher extends EventEmitter {
  private readonly pending: RideRequest[] = [];
  private draining = false;

  constructor(private readonly locator: DriverLocator, private readonly radiusKm = 5) {
    super();
  }

  submit(req: RideRequest): void {
    this.pending.push(req);
    if (!this.draining) {
      this.draining = true;
      setImmediate(() => void this.drain());
    }
  }

  private async drain(): Promise<void> {
    try {
      while (this.pending.length > 0) {
        const req = this.pending.shift()!;
        const candidates = (await this.locator.nearby(req.pickupLat, req.pickupLng, this.radiusKm))
          .filter((d) => d.available)
          .map((d) => ({ d, km: haversineKm(req.pickupLat, req.pickupLng, d.lat, d.lng) }))
          .sort((a, b) => a.km - b.km);
        const best = candidates[0];
        if (!best) {
          this.emit("unassigned", req.rideId);
          continue;
        }
        best.d.available = false;
        this.emit("assigned", { rideId: req.rideId, driverId: best.d.id, distanceKm: best.km } as Assignment);
      }
    } finally {
      this.draining = false;
    }
  }
}
