export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteEstimate {
  durationSeconds: number;
  distanceMeters: number;
  trafficAware: boolean;
}

export class RoutingUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RoutingUnavailableError";
  }
}

export class RouteNotFoundError extends Error {
  constructor(readonly origin: LatLng, readonly destination: LatLng) {
    super("no drivable route between points");
    this.name = "RouteNotFoundError";
  }
}
