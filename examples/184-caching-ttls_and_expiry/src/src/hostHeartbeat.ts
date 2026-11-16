import { LobbyStore } from "./lobbyStore";

export class HostHeartbeatHandler {
  constructor(private readonly lobbies: LobbyStore) {}

  async onHostPing(lobbyId: string, hostId: string): Promise<"ok" | "gone" | "not_host"> {
    const lobby = await this.lobbies.get(lobbyId);
    if (!lobby) return "gone";
    if (lobby.hostId !== hostId) return "not_host";
    const alive = await this.lobbies.heartbeat(lobbyId);
    return alive ? "ok" : "gone";
  }
}
