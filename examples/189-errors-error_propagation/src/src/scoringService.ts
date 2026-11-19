import { MatchState, MatchStore, StaleRevisionError } from "./matchStore";

export class MatchNotFoundError extends Error {
  constructor(matchId: string) {
    super(`match ${matchId} not found`);
    this.name = "MatchNotFoundError";
  }
}

export class InvalidMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoveError";
  }
}

export interface ScoreEvent {
  matchId: string;
  playerId: string;
  points: number;
}

const MAX_ATTEMPTS = 3;

export class ScoringService {
  constructor(
    private readonly store: MatchStore,
    private readonly log: (msg: string, fields: object) => void,
  ) {}

  async applyScore(event: ScoreEvent): Promise<MatchState> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.tryApply(event);
      } catch (err) {
        if (err instanceof StaleRevisionError && attempt < MAX_ATTEMPTS) {
          this.log("score.retry", { matchId: event.matchId, attempt });
          continue;
        }
        throw err;
      }
    }
  }

  private async tryApply(event: ScoreEvent): Promise<MatchState> {
    const current = await this.store.load(event.matchId);
    if (!current) {
      throw new MatchNotFoundError(event.matchId);
    }
    if (current.status !== "active") {
      throw new InvalidMoveError(`match ${current.id} is ${current.status}`);
    }
    if (!current.players.includes(event.playerId)) {
      throw new InvalidMoveError(`player ${event.playerId} is not in match ${current.id}`);
    }

    const next: MatchState = {
      ...current,
      revision: current.revision + 1,
      scores: {
        ...current.scores,
        [event.playerId]: (current.scores[event.playerId] ?? 0) + event.points,
      },
    };
    return this.persist(next, current.revision);
  }

  private async persist(next: MatchState, expected: number): Promise<MatchState> {
    try {
      await this.store.saveIfRevision(next, expected);
      return next;
    } catch (err) {
      if (err instanceof StaleRevisionError) {
        throw err;
      }
      this.log("score.persist_failed", { matchId: next.id, error: String(err) });
      throw new Error(`failed to persist match ${next.id}`, { cause: err });
    }
  }
}
