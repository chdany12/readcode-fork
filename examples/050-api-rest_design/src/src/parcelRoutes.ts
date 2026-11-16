import { Router, Request, Response, NextFunction } from "express";
import { ParcelRepository } from "./parcelRepository";

export function parcelRoutes(repo: ParcelRepository): Router {
  const r = Router({ mergeParams: true });

  r.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ok = await repo.shipmentExists(req.params.shipmentId, res.locals.merchantId);
      if (!ok) return res.status(404).json({ error: "shipment not found" });
      next();
    } catch (e) {
      next(e);
    }
  });

  r.get("/", async (req, res, next) => {
    try {
      res.json({ data: await repo.listByShipment(req.params.shipmentId) });
    } catch (e) {
      next(e);
    }
  });

  r.post("/", async (req, res, next) => {
    try {
      const weight = Number(req.body?.weightGrams);
      if (!Number.isInteger(weight) || weight <= 0 || weight > 70_000) {
        return res.status(422).json({ error: "weightGrams must be an integer between 1 and 70000" });
      }
      const parcel = await repo.insert(req.params.shipmentId, weight);
      res
        .status(201)
        .location(`/shipments/${req.params.shipmentId}/parcels/${parcel.id}`)
        .json(parcel);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:parcelId", async (req, res, next) => {
    try {
      const parcel = await repo.findById(req.params.parcelId);
      if (!parcel) return res.status(404).json({ error: "parcel not found" });
      res.json(parcel);
    } catch (e) {
      next(e);
    }
  });

  r.delete("/:parcelId", async (req, res, next) => {
    try {
      const parcel = await repo.findById(req.params.parcelId);
      if (!parcel || parcel.shipmentId !== req.params.shipmentId) {
        return res.status(404).json({ error: "parcel not found" });
      }
      if (parcel.status !== "pending") {
        return res.status(409).json({ error: `parcel is ${parcel.status}; only pending parcels can be removed` });
      }
      const removed = await repo.deletePending(parcel.id);
      if (!removed) return res.status(409).json({ error: "parcel status changed; retry" });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  return r;
}
