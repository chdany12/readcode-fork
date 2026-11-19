export class StaleRevisionError extends Error {
  constructor(public readonly matchId: string, public readonly expected: number) {
    super(`match ${matchId} changed since revision ${expected}`);
    this.name = "StaleRevisionError";
  }
}

export interface MatchState {
  id: string;
  revision: number;
  players: string[];
  scores: Record<string, number>;
  status: "lobby" | "active" | "finished";
}

export interface MatchStore {
  load(matchId: string): Promise<MatchState | null>;
  saveIfRevision(state: MatchState, expectedRevision: number): Promise<void>;
}
