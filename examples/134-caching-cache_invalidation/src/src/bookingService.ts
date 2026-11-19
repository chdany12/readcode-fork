import { AvailabilityCache, AvailabilityRepo } from "./availabilityCache";

export class BookingError extends Error {}

export class BookingService {
  constructor(private readonly repo: AvailabilityRepo, private readonly cache: AvailabilityCache) {}

  async reserve(hotelId: string, nights: string[], rooms: number): Promise<void> {
    if (nights.length === 0 || rooms <= 0) {
      throw new BookingError("invalid reservation request");
    }
    const ok = await this.repo.decrementRooms(hotelId, nights, rooms);
    if (!ok) {
      throw new BookingError("not enough rooms");
    }
    await this.cache.invalidateHotel(hotelId);
  }

  async updatePrice(hotelId: string, date: string, priceMinor: number): Promise<void> {
    if (!Number.isInteger(priceMinor) || priceMinor <= 0) {
      throw new BookingError("invalid price");
    }
    await this.repo.setPrice(hotelId, date, priceMinor);
    await this.cache.invalidateHotel(hotelId);
  }

  async quote(hotelId: string, nights: string[], rooms: number): Promise<number> {
    let total = 0;
    for (const night of nights) {
      const day = await this.cache.get(hotelId, night);
      if (!day || day.roomsLeft < rooms) {
        throw new BookingError(`no availability on ${night}`);
      }
      total += day.priceMinor * rooms;
    }
    return total;
  }
}
