import { Router, Request, Response } from "express";
import { CampaignRepo, Campaign, CampaignStatus } from "./campaignRepo";

export function campaignRoutes(repo: CampaignRepo): Router {
  const router = Router();

  router.get("/advertisers/:advertiserId/campaigns", async (req: Request, res: Response) => {
    const status = req.query.status as CampaignStatus | undefined;
    const campaigns = await repo.listByAdvertiser(req.params.advertiserId, status);
    res.json({ data: campaigns.map(toDto) });
  });

  router.post("/advertisers/:advertiserId/campaigns", async (req: Request, res: Response) => {
    const { name, dailyBudgetCents } = req.body ?? {};
    if (typeof name !== "string" || !Number.isInteger(dailyBudgetCents) || dailyBudgetCents <= 0) {
      res.status(400).json({ error: "name and positive integer dailyBudgetCents are required" });
      return;
    }
    const created = await repo.create(req.params.advertiserId, name, dailyBudgetCents);
    res.status(201).location(`/campaigns/${created.id}`).json(toDto(created));
  });

  router.get("/campaigns/:id", async (req: Request, res: Response) => {
    const campaign = await repo.get(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "campaign not found" });
      return;
    }
    res.json(toDto(campaign));
  });

  router.patch("/campaigns/:id", async (req: Request, res: Response) => {
    const { dailyBudgetCents } = req.body ?? {};
    if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents <= 0) {
      res.status(400).json({ error: "dailyBudgetCents must be a positive integer" });
      return;
    }
    const updated = await repo.update(req.params.id, { dailyBudgetCents });
    if (!updated) {
      res.status(404).json({ error: "campaign not found" });
      return;
    }
    res.json(toDto(updated));
  });

  router.get("/campaigns/:id/launch", async (req: Request, res: Response) => {
    const campaign = await repo.get(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "campaign not found" });
      return;
    }
    if (campaign.status !== "draft" && campaign.status !== "paused") {
      res.status(409).json({ error: `cannot launch a ${campaign.status} campaign` });
      return;
    }
    const updated = await repo.update(campaign.id, { status: "active" });
    res.json(toDto(updated!));
  });

  router.delete("/campaigns/:id", async (req: Request, res: Response) => {
    const removed = await repo.archive(req.params.id);
    res.status(removed ? 204 : 404).end();
  });

  return router;
}

function toDto(c: Campaign) {
  return {
    id: c.id,
    advertiserId: c.advertiserId,
    name: c.name,
    status: c.status,
    dailyBudgetCents: c.dailyBudgetCents,
    updatedAt: c.updatedAt.toISOString(),
  };
}
