export type ShipmentStatus =
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface Shipment {
  id: string;
  shipperOrgId: string;
  carrierId: string | null;
  status: ShipmentStatus;
  version: number;
}

export interface StatusMeta {
  location?: string;
  actor: string;
}

export interface ShipmentRepo {
  get(id: string): Promise<Shipment | null>;
  assign(id: string, carrierId: string): Promise<void>;
  // Conditional on version; returns null if the row changed since it was read.
  updateStatus(id: string, expectedVersion: number, status: ShipmentStatus, meta: StatusMeta): Promise<Shipment | null>;
}
