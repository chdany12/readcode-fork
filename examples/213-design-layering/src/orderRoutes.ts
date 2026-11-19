import { Router, Request, Response, NextFunction } from "express";
import { OrderService, OrderNotFoundError, InvalidOrderStateError } from "./orderService";
import { OrderRepository } from "./orderRepository";

export function orderRoutes(service: OrderService, orders: OrderRepository): Router {
  const router = Router();

  router.post("/orders", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customerId, lines } = req.body;
      if (!customerId || !Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ error: "customerId and lines are required" });
      }
      const order = await service.placeOrder(customerId, lines);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  });

  router.get("/orders/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await service.getOrder(req.params.id);
      res.json(order);
    } catch (err) {
      next(err);
    }
  });

  router.post("/orders/:id/cancel", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orders.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "order not found" });
      if (order.status !== "pending" && order.status !== "paid") {
        return res.status(409).json({ error: `cannot cancel order in status ${order.status}` });
      }
      await orders.updateStatus(order.id, "cancelled");
      res.json({ ...order, status: "cancelled" });
    } catch (err) {
      next(err);
    }
  });

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof OrderNotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof InvalidOrderStateError) return res.status(409).json({ error: err.message });
    next(err);
  });

  return router;
}
