export interface MatchResult {
  matchId: string;
  playerId: bigint;
  mode: "ranked" | "casual";
  startedAt: Date;
  endedAt: Date;
  score: number;
  ratingDelta: number | null;
}

export interface MatchResultWire {
  match_id: string;
  player_id: string;
  mode: string;
  started_at: string;
  ended_at: string;
  score: number;
  rating_delta?: number | null;
}

export class DecodeError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

const MODES = new Set(["ranked", "casual"]);

function parseInstant(field: string, value: unknown): Date {
  if (typeof value !== "string") throw new DecodeError(field, "expected ISO-8601 string");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new DecodeError(field, "missing time zone or malformed");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new DecodeError(field, "invalid date");
  return d;
}

function parsePlayerId(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) {
    throw new DecodeError("player_id", "expected decimal string");
  }
  const id = BigInt(value);
  if (id > 0xffffffffffffffffn) throw new DecodeError("player_id", "out of range");
  return id;
}

export function decodeMatchResult(raw: unknown): MatchResult {
  if (typeof raw !== "object" || raw === null) throw new DecodeError("$", "expected object");
  const r = raw as Record<string, unknown>;
  if (typeof r.match_id !== "string" || r.match_id.length === 0) {
    throw new DecodeError("match_id", "required");
  }
  if (typeof r.mode !== "string" || !MODES.has(r.mode)) throw new DecodeError("mode", "unknown mode");
  if (typeof r.score !== "number" || !Number.isInteger(r.score)) {
    throw new DecodeError("score", "expected integer");
  }
  const delta = r.rating_delta;
  if (delta !== undefined && delta !== null && (typeof delta !== "number" || !Number.isFinite(delta))) {
    throw new DecodeError("rating_delta", "expected number or null");
  }
  const startedAt = parseInstant("started_at", r.started_at);
  const endedAt = parseInstant("ended_at", r.ended_at);
  if (endedAt < startedAt) throw new DecodeError("ended_at", "before started_at");
  return {
    matchId: r.match_id,
    playerId: parsePlayerId(r.player_id),
    mode: r.mode as MatchResult["mode"],
    startedAt,
    endedAt,
    score: r.score,
    ratingDelta: delta ?? null,
  };
}

export function encodeMatchResult(m: MatchResult): MatchResultWire {
  return {
    match_id: m.matchId,
    player_id: m.playerId.toString(),
    mode: m.mode,
    started_at: m.startedAt.toISOString(),
    ended_at: m.endedAt.toISOString(),
    score: m.score,
    rating_delta: m.ratingDelta,
  };
}
