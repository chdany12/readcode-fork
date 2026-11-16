export interface Clock {
  now(): number;
}

export interface CourierPing {
  courierId: string;
  orderId: string;
  lat: number;
  lng: number;
  at: number;
}

export interface EtaEstimate {
  orderId: string;
  etaMs: number;
  stale: boolean;
}

export class DeliveryEtaTracker {
  private readonly latest = new Map<string, CourierPing>();

  constructor(
    private readonly clock: Clock,
    private readonly speedMetersPerSec = 6,
    private readonly staleAfterMs = 60_000,
  ) {}

  ingest(ping: CourierPing): void {
    const prev = this.latest.get(ping.orderId);
    if (prev && prev.at >= ping.at) return;
    this.latest.set(ping.orderId, ping);
  }

  estimate(orderId: string, dropLat: number, dropLng: number): EtaEstimate | null {
    const ping = this.latest.get(orderId);
    if (!ping) return null;
    const meters = distanceMeters(ping.lat, ping.lng, dropLat, dropLng);
    const travelMs = (meters / this.speedMetersPerSec) * 1000;
    const age = this.clock.now() - ping.at;
    return {
      orderId,
      etaMs: Math.max(0, Math.round(travelMs - age)),
      stale: age > this.staleAfterMs,
    };
  }

  complete(orderId: string): void {
    this.latest.delete(orderId);
  }
}

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
