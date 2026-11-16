export class ShipmentNotFoundError extends Error {
  constructor(public readonly shipmentId: string) {
    super(`shipment ${shipmentId} not found`);
    this.name = "ShipmentNotFoundError";
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(public readonly from: string, public readonly to: string) {
    super(`cannot move shipment from ${from} to ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export class CarrierUnavailableError extends Error {
  constructor(public readonly carrier: string, public readonly retryAfterSeconds: number) {
    super(`carrier ${carrier} is unavailable`);
  }
}

export class AddressRejectedError extends Error {
  constructor(public readonly reason: string) {
    super(`destination address rejected: ${reason}`);
    this.name = "AddressRejectedError";
  }
}
