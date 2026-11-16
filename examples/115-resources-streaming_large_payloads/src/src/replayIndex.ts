import { Pool } from "pg";

export interface ReplayMeta {
  matchId: string;
  shard: string;
  etag: string;
  visibility: "public" | "participants";
  participants: string[];
}

export class ReplayIndex {
  constructor(private readonly pool: Pool) {}

  async find(matchId: string): Promise<ReplayMeta | null> {
    if (!/^[a-f0-9]{24}$/.test(matchId)) return null;
    const { rows } = await this.pool.query(
      `SELECT match_id, shard, etag, visibility, participant_ids
         FROM match_replays WHERE match_id = $1`,
      [matchId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      matchId: r.match_id,
      shard: r.shard,
      etag: r.etag,
      visibility: r.visibility,
      participants: r.participant_ids,
    };
  }

  async recordDownload(matchId: string, playerId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO replay_downloads (match_id, player_id, downloaded_at) VALUES ($1, $2, now())`,
      [matchId, playerId],
    );
  }
}
