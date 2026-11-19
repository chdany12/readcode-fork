import { decodeMatchResult, encodeMatchResult, DecodeError, MatchResult } from "./matchCodec";

export interface ResultStore {
  save(result: MatchResult): Promise<void>;
  recentForPlayer(playerId: bigint, limit: number): Promise<MatchResult[]>;
}

export interface HttpReq { body: string; params: Record<string, string>; }
export interface HttpRes { status: number; body: string; }

export class MatchResultHandler {
  constructor(private readonly store: ResultStore) {}

  async submit(req: HttpReq): Promise<HttpRes> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body);
    } catch {
      return { status: 400, body: JSON.stringify({ error: "malformed_json" }) };
    }
    let result: MatchResult;
    try {
      result = decodeMatchResult(parsed);
    } catch (err) {
      if (err instanceof DecodeError) {
        return { status: 422, body: JSON.stringify({ error: "invalid_field", field: err.field }) };
      }
      throw err;
    }
    await this.store.save(result);
    return { status: 201, body: JSON.stringify(encodeMatchResult(result)) };
  }

  async history(req: HttpReq): Promise<HttpRes> {
    const raw = req.params.playerId;
    if (!/^\d{1,20}$/.test(raw ?? "")) {
      return { status: 400, body: JSON.stringify({ error: "bad_player_id" }) };
    }
    const rows = await this.store.recentForPlayer(BigInt(raw), 20);
    return { status: 200, body: JSON.stringify({ results: rows.map(encodeMatchResult) }) };
  }
}
