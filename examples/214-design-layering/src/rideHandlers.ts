import { Request, Response } from "express";
import { DispatchService, RideNotFound, RideConflict } from "./dispatchService";

export function makeRideHandlers(dispatch: DispatchService) {
  return {
    async request(req: Request, res: Response) {
      const riderId = res.locals.riderId as string;
      try {
        const ride = await dispatch.requestRide(riderId);
        res.status(201).json(ride);
      } catch (err) {
        if (err instanceof RideConflict) return res.status(409).json({ error: err.message });
        throw err;
      }
    },

    async cancel(req: Request, res: Response) {
      const riderId = res.locals.riderId as string;
      try {
        const ride = await dispatch.cancelRide(req.params.rideId, riderId);
        res.json(ride);
      } catch (err) {
        if (err instanceof RideNotFound) return res.status(404).json({ error: err.message });
        if (err instanceof RideConflict) return res.status(409).json({ error: err.message });
        throw err;
      }
    },
  };
}
