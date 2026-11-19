import express from "express";
import { problemHandler } from "./problemHandler";
import { ShipmentService } from "./shipmentService";

export function buildApp(shipments: ShipmentService) {
  const app = express();
  app.use(express.json());

  app.post("/shipments/:id/labels", async (req, res, next) => {
    try {
      const label = await shipments.purchaseLabel(req.params.id, req.body.serviceLevel);
      res.status(201).json(label);
    } catch (err) {
      next(err);
    }
  });

  app.post("/shipments/:id/cancel", async (req, res, next) => {
    try {
      await shipments.cancel(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.use(problemHandler);
  return app;
}
