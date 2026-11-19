export enum CarrierErrorKind {
  InvalidAddress = "invalid_address",
  Unauthorized = "unauthorized",
  RateLimited = "rate_limited",
  Unavailable = "unavailable",
  Rejected = "rejected",
}

export class CarrierError extends Error {
  constructor(
    readonly kind: CarrierErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CarrierError";
  }

  static fromStatus(status: number, body: string): CarrierError {
    const snippet = body.slice(0, 200);
    if (status === 401 || status === 403) {
      return new CarrierError(CarrierErrorKind.Unauthorized, `ShipRelay auth failed (${status})`);
    }
    if (status === 422) {
      return new CarrierError(CarrierErrorKind.InvalidAddress, `ShipRelay rejected address: ${snippet}`);
    }
    if (status === 429 || status >= 500) {
      return new CarrierError(CarrierErrorKind.Unavailable, `ShipRelay unavailable (${status})`);
    }
    return new CarrierError(CarrierErrorKind.Rejected, `ShipRelay error ${status}: ${snippet}`);
  }
}
