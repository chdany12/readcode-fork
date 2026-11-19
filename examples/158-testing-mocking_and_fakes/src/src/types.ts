export interface Clock { now(): Date }

export interface LabelRequest {
  reference: string;
  weightGrams: number;
  destinationPostcode: string;
  pickupDate: string;
}

export interface CarrierClient {
  createLabel(req: LabelRequest): Promise<{ trackingNumber: string }>;
}

export interface Shipment {
  id: string;
  weightGrams: number;
  destinationPostcode: string;
  trackingNumber?: string;
  pickupDate?: string;
  dispatchedAt?: string;
}

export interface ShipmentRepo {
  get(id: string): Promise<Shipment | undefined>;
  save(s: Shipment): Promise<void>;
}

export type DispatchResult =
  | { status: "not_found" }
  | { status: "already_dispatched"; trackingNumber: string }
  | { status: "dispatched"; trackingNumber: string };
