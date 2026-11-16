export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RideRequest {
  id: string;
  riderId: string;
  pickup: GeoPoint;
  vehicleClass: "standard" | "xl" | "premium";
  requestedAt: number;
}

export interface DriverCandidate {
  driverId: string;
  location: GeoPoint;
  vehicleClass: RideRequest["vehicleClass"];
  rating: number;
  lastTripEndedAt: number | null;
}

export type DispatchDecision =
  | { kind: "assigned"; driverId: string; etaSeconds: number }
  | { kind: "no_drivers"; searchedRadiusKm: number }
  | { kind: "deferred"; retryAfterMs: number };

export interface DriverLocator {
  findNearby(center: GeoPoint, radiusKm: number): Promise<readonly DriverCandidate[]>;
}

export interface MatchingStrategy {
  choose(request: RideRequest, candidates: readonly DriverCandidate[]): DriverCandidate | null;
}

export interface EtaEstimator {
  etaSeconds(from: GeoPoint, to: GeoPoint): number;
}

export interface Clock {
  now(): number;
}
