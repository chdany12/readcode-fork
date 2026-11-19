import { Clock, DriverCandidate, EtaEstimator, MatchingStrategy, RideRequest } from "./types";

export class NearestIdleStrategy implements MatchingStrategy {
  constructor(
    private readonly eta: EtaEstimator,
    private readonly clock: Clock,
    private readonly minIdleMs: number,
  ) {}

  choose(request: RideRequest, candidates: readonly DriverCandidate[]): DriverCandidate | null {
    const now = this.clock.now();
    let best: DriverCandidate | null = null;
    let bestEta = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      const idleFor = c.lastTripEndedAt === null ? Number.POSITIVE_INFINITY : now - c.lastTripEndedAt;
      if (idleFor < this.minIdleMs) continue;
      const eta = this.eta.etaSeconds(c.location, request.pickup);
      if (eta < bestEta || (eta === bestEta && best !== null && c.rating > best.rating)) {
        best = c;
        bestEta = eta;
      }
    }
    return best;
  }
}
