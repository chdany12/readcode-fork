import { Request, Response, NextFunction } from "express";
import { OrderService } from "./orderService";

export function createOrderHandler(orders: OrderService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header("Idempotency-Key");
    if (!key || key.length > 128) {
      res.status(400).json({ error: "missing_or_invalid_idempotency_key" });
      return;
    }
    const lines = req.body?.lines;
    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ error: "lines_required" });
      return;
    }
    try {
      const result = await orders.createOrder({
        customerId: res.locals.customerId,
        idempotencyKey: key,
        lines,
      });
      res.status(result.status).json(result.body);
    } catch (err) {
      next(err);
    }
  };
}
