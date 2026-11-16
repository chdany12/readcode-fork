import { RideRepository, Ride } from "./rideRepository";

export interface DriverRegistry {
  markAvailable(driverId: string): Promise<void>;
}

export interface Notifier {
  rideCancelled(ride: Ride, by: "rider" | "driver"): Promise<void>;
}

export class RideNotFound extends Error {}
export class RideConflict extends Error {}

export class DispatchService {
  constructor(
    private readonly rides: RideRepository,
    private readonly drivers: DriverRegistry,
    private readonly notifier: Notifier,
  ) {}

  async requestRide(riderId: string): Promise<Ride> {
    const active = await this.rides.findActiveForRider(riderId);
    if (active) {
      throw new RideConflict(`rider ${riderId} already has ride ${active.id}`);
    }
    return this.rides.create(riderId);
  }

  async cancelRide(rideId: string, riderId: string): Promise<Ride> {
    const ride = await this.rides.findById(rideId);
    if (!ride || ride.riderId !== riderId) {
      throw new RideNotFound(`ride ${rideId} not found`);
    }
    if (ride.status === "in_progress" || ride.status === "completed") {
      throw new RideConflict(`ride ${rideId} cannot be cancelled in status ${ride.status}`);
    }
    if (ride.status === "cancelled") {
      return ride;
    }

    await this.rides.setStatus(ride.id, "cancelled");
    if (ride.driverId) {
      await this.drivers.markAvailable(ride.driverId);
    }
    const cancelled: Ride = { ...ride, status: "cancelled" };
    await this.notifier.rideCancelled(cancelled, "rider");
    return cancelled;
  }
}
