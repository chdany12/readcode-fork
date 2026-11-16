export interface Redis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<"OK" | null>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
}

export interface Lobby {
  id: string;
  hostId: string;
  mode: "duel" | "squad" | "battle_royale";
  maxPlayers: number;
  players: string[];
  status: "open" | "starting";
  updatedAt: number;
}
