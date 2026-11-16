import { Router } from "express";
import { ShipmentRepo, ShipmentStatus, Shipment } from "./shipments";
import { Principal, requirePrincipal } from "./principal";

const CARRIER_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: [],
  picked_up: ["in_transit"],
  in_transit: ["out_for_delivery", "exception"],
  out_for_delivery: ["delivered", "exception"],
  delivered: [],
  exception: ["in_transit"],
};

export function shipmentRouter(repo: ShipmentRepo): Router {
  const router = Router();
  router.use(requirePrincipal);

  router.get("/shipments/:id", async (req, res) => {
    const principal = res.locals.principal as Principal;
    const shipment = await repo.get(req.params.id);
    if (!shipment || !canSee(principal, shipment)) {
      return res.status(404).json({ error: "not_found" });
    }
    res.json(shipment);
  });

  router.post("/shipments/:id/assign", async (req, res) => {
    const principal = res.locals.principal as Principal;
    if (principal.kind !== "dispatcher") {
      return res.status(403).json({ error: "forbidden" });
    }
    const { carrierId } = req.body ?? {};
    if (typeof carrierId !== "string") {
      return res.status(400).json({ error: "carrierId required" });
    }
    const shipment = await repo.get(req.params.id);
    if (!shipment || shipment.shipperOrgId !== principal.orgId) {
      return res.status(404).json({ error: "not_found" });
    }
    if (shipment.status !== "created") {
      return res.status(409).json({ error: "already_assigned" });
    }
    await repo.assign(shipment.id, carrierId);
    res.status(204).end();
  });

  router.post("/shipments/:id/status", async (req, res) => {
    const principal = res.locals.principal as Principal;
    if (principal.kind !== "carrier") {
      return res.status(403).json({ error: "forbidden" });
    }
    const { status, location } = req.body ?? {};
    const shipment = await repo.get(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: "not_found" });
    }
    const allowed = CARRIER_TRANSITIONS[shipment.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(409).json({ error: "invalid_transition", from: shipment.status, to: status });
    }
    const updated = await repo.updateStatus(shipment.id, shipment.version, status, {
      location: typeof location === "string" ? location : undefined,
      actor: `${principal.kind}:${principal.orgId}`,
    });
    if (!updated) {
      return res.status(409).json({ error: "concurrent_update" });
    }
    res.json(updated);
  });

  return router;
}

function canSee(p: Principal, s: Shipment): boolean {
  if (p.kind === "dispatcher") return s.shipperOrgId === p.orgId;
  return s.carrierId === p.orgId;
}
