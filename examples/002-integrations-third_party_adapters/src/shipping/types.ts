export type Money = { amountCents: number; currency: string };

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface ShipmentRequest {
  orderId: string;
  from: Address;
  to: Address;
  weightGrams: number;
  serviceLevel: "ground" | "express";
}

export interface Label {
  carrierShipmentId: string;
  trackingNumber: string;
  labelUrl: string;
  cost: Money;
}

export class CarrierError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidAddressError extends CarrierError {
  constructor(readonly field: string, message: string) {
    super(message, false);
  }
}

export class CarrierRateLimitedError extends CarrierError {
  constructor(readonly retryAfterMs: number) {
    super(`carrier rate limited, retry after ${retryAfterMs}ms`, true);
  }
}

export class CarrierUnavailableError extends CarrierError {
  constructor(message: string, cause?: unknown) {
    super(message, true, cause);
  }
}
