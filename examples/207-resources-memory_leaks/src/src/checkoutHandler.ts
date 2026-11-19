import type { Request, Response } from "express";
import { PaymentOutcomeWaiter } from "./outcomeWaiter";

export interface Processor {
  submit(paymentId: string, amountMinor: number, currency: string): Promise<void>;
}

export function checkoutHandler(processor: Processor, waiter: PaymentOutcomeWaiter) {
  return async (req: Request, res: Response): Promise<void> => {
    const { paymentId, amountMinor, currency } = req.body;
    if (typeof paymentId !== "string" || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      res.status(400).json({ error: "invalid payment" });
      return;
    }
    const outcomeP = waiter.wait(paymentId, 10_000);
    try {
      await processor.submit(paymentId, amountMinor, currency);
      const outcome = await outcomeP;
      res.status(outcome.status === "succeeded" ? 200 : 402).json(outcome);
    } catch (err) {
      outcomeP.catch(() => undefined);
      res.status(202).json({ paymentId, status: "pending" });
    }
  };
}
