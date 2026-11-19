import express from "express";
import { resolveVersion } from "./versioning";
import { Ticket, toV1, toV2 } from "./ticketViews";
import { TicketRepository } from "./ticketRepository";

function render(version: string, ticket: Ticket) {
  return version === "2023-06-01" ? toV1(ticket) : toV2(ticket);
}

export function ticketRouter(repo: TicketRepository) {
  const router = express.Router();
  router.use(resolveVersion);

  router.get("/tickets/:id", async (req, res, next) => {
    try {
      const ticket = await repo.findById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "ticket_not_found" });
      res.setHeader("Cache-Control", "private, max-age=30");
      res.json(render(req.apiVersion, ticket));
    } catch (err) {
      next(err);
    }
  });

  router.get("/tickets", async (req, res, next) => {
    try {
      const tickets = await repo.listRecent(50);
      res.json({ data: tickets.map((t) => render(req.apiVersion, t)) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
