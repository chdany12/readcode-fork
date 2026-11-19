import { Redis } from "ioredis";

export interface RoomAvailability {
  hotelId: string;
  date: string;
  roomsLeft: number;
  priceMinor: number;
}

export interface AvailabilityRepo {
  load(hotelId: string, date: string): Promise<RoomAvailability | null>;
  decrementRooms(hotelId: string, dates: string[], count: number): Promise<boolean>;
  setPrice(hotelId: string, date: string, priceMinor: number): Promise<void>;
}

const TTL_SECONDS = 300;

function dataKey(hotelId: string, date: string, version: string): string {
  return `avail:${hotelId}:${date}:v${version}`;
}

function versionKey(hotelId: string): string {
  return `avail-ver:${hotelId}`;
}

export class AvailabilityCache {
  constructor(private readonly redis: Redis, private readonly repo: AvailabilityRepo) {}

  private async currentVersion(hotelId: string): Promise<string> {
    return (await this.redis.get(versionKey(hotelId))) ?? "0";
  }

  async get(hotelId: string, date: string): Promise<RoomAvailability | null> {
    const version = await this.currentVersion(hotelId);
    const cached = await this.redis.get(dataKey(hotelId, date, version));
    if (cached) {
      return JSON.parse(cached) as RoomAvailability;
    }

    const fresh = await this.repo.load(hotelId, date);
    if (fresh) {
      await this.redis.set(dataKey(hotelId, date, version), JSON.stringify(fresh), "EX", TTL_SECONDS);
    }
    return fresh;
  }

  async invalidateHotel(hotelId: string): Promise<void> {
    await this.redis.incr(versionKey(hotelId));
  }
}
