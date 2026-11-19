import { Router, Request, Response, NextFunction } from "express";
import { RefundService } from "./refundService";

interface MerchantRequest extends Request {
  merchantId: string;
}

export function refundRoutes(service: RefundService): Router {
  const router = Router();

  router.post("/charges/:chargeId/refunds", async (req: Request, res: Response, next: NextFunction) => {
    const { merchantId } = req as MerchantRequest;
    const key = req.header("Idempotency-Key");
    if (!key) {
      res.status(400).json({ error: "idempotency_key_required" });
      return;
    }
    const amountCents = Number(req.body?.amountCents);
    if (!Number.isInteger(amountCents)) {
      res.status(400).json({ error: "amount_must_be_integer_cents" });
      return;
    }
    try {
      const result = await service.refund(merchantId, key, req.params.chargeId, amountCents);
      res.status(result.status).json(result.body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
