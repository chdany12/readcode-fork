import { createHash } from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import { IdempotencyStore } from "./idempotencyStore";
import { TicketService } from "./ticketService";

interface TenantRequest extends Request {
  tenantId: string;
}

function fingerprintOf(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export function ticketRoutes(tickets: TicketService, idem: IdempotencyStore): Router {
  const router = Router();

  router.post("/tickets", async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = req as TenantRequest;
    const key = req.header("Idempotency-Key");
    if (!key || key.length > 128) {
      res.status(400).json({ error: "idempotency_key_required" });
      return;
    }
    const { subject, description, requesterEmail, priority } = req.body ?? {};
    if (typeof subject !== "string" || subject.trim() === "" || typeof requesterEmail !== "string") {
      res.status(422).json({ error: "invalid_ticket" });
      return;
    }

    const fingerprint = fingerprintOf({ subject, description, requesterEmail, priority });
    try {
      const existing = await idem.find(tenantId, key);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          res.status(422).json({ error: "idempotency_key_reused" });
          return;
        }
        res.status(existing.response.status).json(existing.response.body);
        return;
      }

      const ticket = await tickets.create(tenantId, {
        subject: subject.trim(),
        description: description ?? "",
        requesterEmail,
        priority: priority ?? "normal",
      });
      const body = { id: ticket.id, number: ticket.number, status: ticket.status };
      await idem.save(tenantId, key, fingerprint, { status: 201, body });
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
