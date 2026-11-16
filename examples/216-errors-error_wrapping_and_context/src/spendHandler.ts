import { Request, Response } from "express";
import { AppError, collectFields, errorChain } from "./errors";
import { SpendReportService } from "./spendReportService";

export interface Logger { error(msg: string, fields: Record<string, unknown>): void; }

const STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  upstream_unavailable: 503,
  internal: 500,
};

export function spendHandler(service: SpendReportService, log: Logger) {
  return async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    try {
      const rows = await service.dailySpend(campaignId, from, to);
      res.json({ campaignId, rows });
    } catch (err) {
      const kind = err instanceof AppError ? err.kind : "internal";
      const status = STATUS[kind] ?? 500;
      if (status >= 500) {
        log.error("spend report failed", {
          route: "GET /campaigns/:campaignId/spend",
          error: errorChain(err),
          ...collectFields(err),
        });
      }
      const publicMessage = status >= 500 ? "spend report temporarily unavailable" : (err as Error).message;
      res.status(status).json({ error: kind, message: publicMessage });
    }
  };
}
