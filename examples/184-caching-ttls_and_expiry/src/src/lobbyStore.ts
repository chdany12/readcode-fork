import { randomUUID } from "crypto";
import { Lobby, Redis } from "./redis";

const LOBBY_TTL_SECONDS = 120;
const OPEN_LOBBIES = "lobbies:open";

export class LobbyFullError extends Error {}
export class LobbyNotFoundError extends Error {}

export class LobbyStore {
  constructor(private readonly redis: Redis) {}

  private key(id: string): string {
    return `lobby:${id}`;
  }

  async create(hostId: string, mode: Lobby["mode"], maxPlayers: number): Promise<Lobby> {
    const lobby: Lobby = {
      id: randomUUID(),
      hostId,
      mode,
      maxPlayers,
      players: [hostId],
      status: "open",
      updatedAt: Date.now(),
    };
    await this.redis.set(this.key(lobby.id), JSON.stringify(lobby), "EX", LOBBY_TTL_SECONDS, "NX");
    await this.redis.sadd(OPEN_LOBBIES, lobby.id);
    return lobby;
  }

  async get(id: string): Promise<Lobby | null> {
    const raw = await this.redis.get(this.key(id));
    if (!raw) {
      await this.redis.srem(OPEN_LOBBIES, id);
      return null;
    }
    return JSON.parse(raw) as Lobby;
  }

  async heartbeat(id: string): Promise<boolean> {
    return (await this.redis.expire(this.key(id), LOBBY_TTL_SECONDS)) === 1;
  }

  async join(id: string, playerId: string): Promise<Lobby> {
    const lobby = await this.get(id);
    if (!lobby) throw new LobbyNotFoundError(id);
    if (lobby.players.includes(playerId)) return lobby;
    if (lobby.players.length >= lobby.maxPlayers) throw new LobbyFullError(id);

    lobby.players.push(playerId);
    lobby.updatedAt = Date.now();
    await this.redis.set(this.key(id), JSON.stringify(lobby), "XX");
    return lobby;
  }

  async leave(id: string, playerId: string): Promise<void> {
    const lobby = await this.get(id);
    if (!lobby) return;
    lobby.players = lobby.players.filter((p) => p !== playerId);
    if (lobby.players.length === 0) {
      await this.redis.del(this.key(id));
      await this.redis.srem(OPEN_LOBBIES, id);
      return;
    }
    if (lobby.hostId === playerId) lobby.hostId = lobby.players[0];
    lobby.updatedAt = Date.now();
    await this.redis.set(this.key(id), JSON.stringify(lobby), "XX", "KEEPTTL");
  }
}
