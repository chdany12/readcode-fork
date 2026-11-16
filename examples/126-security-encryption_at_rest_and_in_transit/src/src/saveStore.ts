import { Pool } from "pg";
import { KeyRing, openSave, sealSave, needsRewrap, SaveDecryptError } from "./saveCrypto";

export interface GameSave {
  level: number;
  inventory: string[];
  coins: number;
  updatedAt: string;
}

export class SaveStore {
  constructor(private readonly db: Pool, private readonly ring: KeyRing) {}

  async write(playerId: string, slot: number, save: GameSave): Promise<void> {
    const blob = sealSave(this.ring, playerId, slot, Buffer.from(JSON.stringify(save), "utf8"));
    await this.db.query(
      `INSERT INTO player_saves (player_id, slot, blob, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (player_id, slot) DO UPDATE SET blob = EXCLUDED.blob, updated_at = now()`,
      [playerId, slot, blob],
    );
  }

  async read(playerId: string, slot: number): Promise<GameSave | null> {
    const res = await this.db.query<{ blob: Buffer }>(
      "SELECT blob FROM player_saves WHERE player_id = $1 AND slot = $2",
      [playerId, slot],
    );
    if (res.rowCount === 0) return null;
    const blob = res.rows[0].blob;
    let plaintext: Buffer;
    try {
      plaintext = openSave(this.ring, playerId, slot, blob);
    } catch (err) {
      if (err instanceof SaveDecryptError) {
        console.warn(JSON.stringify({ event: "save_decrypt_failed", playerId, slot, reason: err.message }));
      }
      throw err;
    }
    const save = JSON.parse(plaintext.toString("utf8")) as GameSave;
    if (needsRewrap(this.ring, blob)) {
      await this.write(playerId, slot, save);
    }
    return save;
  }
}
