import { MapsRoutingAdapter } from "./mapsRoutingAdapter";
import { LatLng, RouteNotFoundError, RoutingUnavailableError } from "./types";

export interface PickupEta {
  minutes: number;
  source: "provider" | "fallback";
}

const FALLBACK_SPEED_MPS = 8;

export class PickupEtaService {
  constructor(private readonly routing: MapsRoutingAdapter) {}

  async etaForDriver(driver: LatLng, rider: LatLng): Promise<PickupEta> {
    try {
      const est = await this.routing.estimate(driver, rider);
      return { minutes: Math.ceil(est.durationSeconds / 60), source: "provider" };
    } catch (err) {
      if (err instanceof RouteNotFoundError) throw err;
      if (err instanceof RoutingUnavailableError) {
        const meters = haversineMeters(driver, rider) * 1.4;
        return { minutes: Math.ceil(meters / FALLBACK_SPEED_MPS / 60), source: "fallback" };
      }
      throw err;
    }
  }
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
