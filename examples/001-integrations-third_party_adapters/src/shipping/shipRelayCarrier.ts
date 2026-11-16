import { ShipRelayClient } from "./shipRelayClient";
import { CarrierError, CarrierErrorKind } from "./errors";

export interface Address {
  name: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface Parcel {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface Quote {
  serviceCode: string;
  amountCents: number;
  currency: string;
  estimatedDays: number | null;
}

export interface PurchasedLabel {
  trackingNumber: string;
  labelUrl: string;
  costCents: number;
}

export interface ShippingCarrier {
  quote(from: Address, to: Address, parcel: Parcel): Promise<Quote[]>;
  buyLabel(orderId: string, quote: Quote, from: Address, to: Address, parcel: Parcel): Promise<PurchasedLabel>;
}

interface SrRate {
  service: string;
  total: string;
  currency: string;
  transit_days?: number;
}

interface SrShipment {
  tracking_code: string;
  label: { url: string };
  charged: { amount: string };
}

export class ShipRelayCarrier implements ShippingCarrier {
  constructor(private readonly client: ShipRelayClient) {}

  async quote(from: Address, to: Address, parcel: Parcel): Promise<Quote[]> {
    const res = await this.client.request<{ rates: SrRate[] }>("POST", "/v2/rates", {
      origin: toSrAddress(from),
      destination: toSrAddress(to),
      parcel: toSrParcel(parcel),
    });
    return res.rates.map((r) => ({
      serviceCode: r.service,
      amountCents: toCents(r.total),
      currency: r.currency,
      estimatedDays: r.transit_days ?? null,
    }));
  }

  async buyLabel(orderId: string, quote: Quote, from: Address, to: Address, parcel: Parcel): Promise<PurchasedLabel> {
    const res = await this.client.request<SrShipment>("POST", "/v2/shipments", {
      reference: orderId,
      service: quote.serviceCode,
      origin: toSrAddress(from),
      destination: toSrAddress(to),
      parcel: toSrParcel(parcel),
    });
    const costCents = toCents(res.charged.amount);
    if (costCents > quote.amountCents) {
      throw new CarrierError(
        CarrierErrorKind.Rejected,
        `label for ${orderId} cost ${costCents} exceeds quoted ${quote.amountCents}`,
      );
    }
    return { trackingNumber: res.tracking_code, labelUrl: res.label.url, costCents };
  }
}

function toSrAddress(a: Address) {
  return { name: a.name, street1: a.line1, city: a.city, zip: a.postalCode, country: a.country.toUpperCase() };
}

function toSrParcel(p: Parcel) {
  return { weight_oz: Math.ceil(p.weightGrams / 28.35), length_in: p.lengthCm / 2.54, width_in: p.widthCm / 2.54, height_in: p.heightCm / 2.54 };
}

function toCents(decimal: string): number {
  const [whole, frac = ""] = decimal.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}
