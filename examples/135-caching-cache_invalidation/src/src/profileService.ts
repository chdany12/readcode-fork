import { Redis } from "ioredis";

export interface PlayerProfile {
  playerId: string;
  displayName: string;
  rating: number;
  region: string;
}

export interface ProfileRepo {
  byId(playerId: string): Promise<PlayerProfile | null>;
  idByName(displayName: string): Promise<string | null>;
  rename(playerId: string, newName: string): Promise<void>;
  updateRating(playerId: string, rating: number): Promise<void>;
}

const PROFILE_TTL = 600;
const NAME_TTL = 3600;

const profileKey = (id: string) => `profile:${id}`;
const nameKey = (name: string) => `profile-name:${name.toLowerCase()}`;

export class ProfileService {
  constructor(private readonly redis: Redis, private readonly repo: ProfileRepo) {}

  async getById(playerId: string): Promise<PlayerProfile | null> {
    const hit = await this.redis.get(profileKey(playerId));
    if (hit) return JSON.parse(hit) as PlayerProfile;
    const profile = await this.repo.byId(playerId);
    if (profile) {
      await this.redis.set(profileKey(playerId), JSON.stringify(profile), "EX", PROFILE_TTL);
    }
    return profile;
  }

  async getByName(displayName: string): Promise<PlayerProfile | null> {
    let playerId = await this.redis.get(nameKey(displayName));
    if (!playerId) {
      playerId = await this.repo.idByName(displayName);
      if (!playerId) return null;
      await this.redis.set(nameKey(displayName), playerId, "EX", NAME_TTL);
    }
    return this.getById(playerId);
  }

  async rename(playerId: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      throw new Error("display name must be 3-20 characters");
    }
    const current = await this.getById(playerId);
    if (!current) throw new Error("unknown player");
    const taken = await this.repo.idByName(trimmed);
    if (taken && taken !== playerId) throw new Error("display name taken");

    await this.repo.rename(playerId, trimmed);
    await this.redis.del(profileKey(playerId), nameKey(trimmed));
  }

  async recordMatchResult(playerId: string, newRating: number): Promise<void> {
    await this.repo.updateRating(playerId, newRating);
    await this.redis.del(profileKey(playerId));
  }
}
