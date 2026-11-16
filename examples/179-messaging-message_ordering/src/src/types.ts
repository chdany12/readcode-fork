export type TripEventType = "requested" | "driver_assigned" | "driver_arrived" | "started" | "completed" | "cancelled";

export interface TripEvent {
  tripId: string;
  seq: number;
  type: TripEventType;
  driverId?: string;
  occurredAt: string;
}

export interface TripState {
  tripId: string;
  lastSeq: number;
  status: TripEventType;
  driverId: string | null;
}

export interface TripStore {
  load(tripId: string): Promise<TripState | null>;
  save(state: TripState): Promise<void>;
}
