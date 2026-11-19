import { FareQuote, PricingEngine } from "./pricingEngine";
import { TravelerProfile, discountRate } from "./loyalty";

export interface BookingRepository {
  insert(record: BookingRecord): Promise<void>;
}

export interface PaymentGateway {
  charge(travelerId: string, amountCents: number, currency: string, reference: string): Promise<{ chargeId: string }>;
}

export interface BookingRequest {
  bookingId: string;
  origin: string;
  destination: string;
  date: string;
  traveler: TravelerProfile;
}

export interface BookingRecord {
  bookingId: string;
  travelerId: string;
  routeKey: string;
  chargedCents: number;
  currency: string;
  chargeId: string;
}

export class BookingService {
  constructor(
    private readonly pricing: PricingEngine,
    private readonly payments: PaymentGateway,
    private readonly bookings: BookingRepository,
  ) {}

  async book(req: BookingRequest): Promise<BookingRecord> {
    const quote = await this.pricing.quote(req.origin, req.destination, req.date);
    const priced = this.applyLoyalty(quote, req.traveler);

    if (priced.totalCents <= 0) {
      throw new Error(`invalid fare for ${priced.routeKey}: ${priced.totalCents}`);
    }

    const { chargeId } = await this.payments.charge(
      req.traveler.travelerId,
      priced.totalCents,
      priced.currency,
      req.bookingId,
    );

    const record: BookingRecord = {
      bookingId: req.bookingId,
      travelerId: req.traveler.travelerId,
      routeKey: priced.routeKey,
      chargedCents: priced.totalCents,
      currency: priced.currency,
      chargeId,
    };
    await this.bookings.insert(record);
    return record;
  }

  private applyLoyalty(quote: FareQuote, traveler: TravelerProfile): FareQuote {
    const rate = discountRate(traveler);
    if (rate === 0) {
      return quote;
    }
    const discount = Math.round(quote.baseFareCents * rate);
    quote.baseFareCents -= discount;
    quote.totalCents = quote.baseFareCents + quote.taxesCents;
    return quote;
  }
}
