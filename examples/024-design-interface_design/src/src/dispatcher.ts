import {
  Clock, DispatchDecision, DriverCandidate, DriverLocator,
  EtaEstimator, MatchingStrategy, RideRequest,
} from "./types";

export interface DispatcherOptions {
  radiiKm: readonly number[];
  maxRequestAgeMs: number;
  deferMs: number;
}

export class Dispatcher {
  constructor(
    private readonly locator: DriverLocator,
    private readonly strategy: MatchingStrategy,
    private readonly eta: EtaEstimator,
    private readonly clock: Clock,
    private readonly opts: DispatcherOptions,
  ) {
    if (opts.radiiKm.length === 0) {
      throw new Error("at least one search radius is required");
    }
  }

  async dispatch(request: RideRequest): Promise<DispatchDecision> {
    let lastRadius = 0;
    for (const radius of this.opts.radiiKm) {
      lastRadius = radius;
      const nearby = await this.locator.findNearby(request.pickup, radius);
      const eligible = nearby.filter((c) => c.vehicleClass === request.vehicleClass);
      const chosen = this.strategy.choose(request, eligible);
      if (chosen !== null) {
        return {
          kind: "assigned",
          driverId: chosen.driverId,
          etaSeconds: this.eta.etaSeconds(chosen.location, request.pickup),
        };
      }
    }
    const age = this.clock.now() - request.requestedAt;
    if (age < this.opts.maxRequestAgeMs) {
      return { kind: "deferred", retryAfterMs: this.opts.deferMs };
    }
    return { kind: "no_drivers", searchedRadiusKm: lastRadius };
  }
}

export function describe(decision: DispatchDecision): string {
  switch (decision.kind) {
    case "assigned":
      return `driver ${decision.driverId} arriving in ${Math.round(decision.etaSeconds / 60)} min`;
    case "no_drivers":
      return `no drivers within ${decision.searchedRadiusKm} km`;
    case "deferred":
      return `retrying in ${decision.retryAfterMs} ms`;
    default: {
      const unreachable: never = decision;
      throw new Error(`unhandled decision ${JSON.stringify(unreachable)}`);
    }
  }
}
