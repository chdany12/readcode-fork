import express, { NextFunction, Request, Response } from "express";
import { AssignmentService } from "./assignmentService";

export function assignmentRouter(service: AssignmentService) {
  const router = express.Router();

  router.post(
    "/tenants/:tenantId/tickets/:ticketId/assignee",
    async (req: Request, res: Response, next: NextFunction) => {
      const agentId = typeof req.body?.agentId === "string" ? req.body.agentId : "";
      if (!agentId) {
        res.status(400).json({ error: "agentId is required" });
        return;
      }
      try {
        const ticket = await service.assign(req.params.tenantId, req.params.ticketId, agentId);
        res.status(200).json(ticket);
      } catch (err) {
        next(err);
      }
    },
  );

  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = status < 500 && err instanceof Error ? err.message : "internal error";
    res.status(status).json({ error: message });
  });

  return router;
}
