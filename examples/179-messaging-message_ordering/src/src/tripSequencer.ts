import { TripEvent, TripState, TripStore } from "./types";

const MAX_PENDING_PER_TRIP = 50;

export class TripSequencer {
  private readonly pending = new Map<string, Map<number, TripEvent>>();
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly store: TripStore,
    private readonly onGap: (tripId: string, expectedSeq: number) => void,
  ) {}

  handle(event: TripEvent): Promise<void> {
    const prev = this.chains.get(event.tripId) ?? Promise.resolve();
    const next = prev.then(() => this.process(event));
    const tracked = next.catch(() => undefined);
    this.chains.set(event.tripId, tracked);
    tracked.then(() => {
      if (this.chains.get(event.tripId) === tracked) {
        this.chains.delete(event.tripId);
      }
    });
    return next;
  }

  private async process(event: TripEvent): Promise<void> {
    const state = (await this.store.load(event.tripId)) ?? this.initial(event.tripId);

    if (event.seq <= state.lastSeq) {
      return;
    }

    const buffer = this.pending.get(event.tripId) ?? new Map<number, TripEvent>();
    buffer.set(event.seq, event);

    let current = state;
    let applied = false;
    while (buffer.has(current.lastSeq + 1)) {
      const nextEvent = buffer.get(current.lastSeq + 1)!;
      buffer.delete(nextEvent.seq);
      current = this.apply(current, nextEvent);
      applied = true;
    }

    if (applied) {
      await this.store.save(current);
    }

    if (buffer.size === 0) {
      this.pending.delete(event.tripId);
      return;
    }

    if (buffer.size > MAX_PENDING_PER_TRIP) {
      this.pending.delete(event.tripId);
      throw new Error(`trip ${event.tripId}: ${buffer.size} events stuck waiting for seq ${current.lastSeq + 1}`);
    }

    this.pending.set(event.tripId, buffer);
    this.onGap(event.tripId, current.lastSeq + 1);
  }

  private initial(tripId: string): TripState {
    return { tripId, lastSeq: 0, status: "requested", driverId: null };
  }

  private apply(state: TripState, event: TripEvent): TripState {
    switch (event.type) {
      case "driver_assigned":
        return { ...state, lastSeq: event.seq, status: event.type, driverId: event.driverId ?? null };
      case "cancelled":
        return { ...state, lastSeq: event.seq, status: event.type, driverId: null };
      default:
        return { ...state, lastSeq: event.seq, status: event.type };
    }
  }
}
