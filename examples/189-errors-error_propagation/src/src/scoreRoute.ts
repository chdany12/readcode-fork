import { ScoringService, ScoreEvent, MatchNotFoundError, InvalidMoveError } from "./scoringService";
import { StaleRevisionError } from "./matchStore";

export interface Reply {
  status: number;
  body: unknown;
}

export async function handleScoreBatch(
  scoring: ScoringService,
  events: ScoreEvent[],
): Promise<Reply> {
  const results: { matchId: string; ok: boolean; error?: string }[] = [];

  for (const event of events) {
    try {
      await scoring.applyScore(event);
      results.push({ matchId: event.matchId, ok: true });
    } catch (err) {
      if (err instanceof MatchNotFoundError || err instanceof InvalidMoveError) {
        results.push({ matchId: event.matchId, ok: false, error: err.message });
        continue;
      }
      if (err instanceof StaleRevisionError) {
        return { status: 409, body: { error: "match busy, retry", results } };
      }
      results.push({ matchId: event.matchId, ok: false, error: "internal" });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return { status: failed === 0 ? 200 : 207, body: { results } };
}
