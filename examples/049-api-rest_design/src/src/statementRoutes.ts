import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { LedgerRepo, Statement } from "./ledgerRepo";

function toJson(s: Statement, currency: string) {
  return {
    id: s.id,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    currency,
    openingBalance: s.openingBalanceMinor.toString(),
    closingBalance: s.closingBalanceMinor.toString(),
    entryCount: s.entryCount,
    links: { self: `/accounts/${s.accountId}/statements/${s.id}` },
  };
}

export function statementRouter(repo: LedgerRepo) {
  const router = express.Router();

  async function loadAccount(req: Request, res: Response, next: NextFunction) {
    const ownerId = res.locals.customerId as string;
    const account = await repo.findAccount(req.params.accountId, ownerId);
    if (!account) {
      res.status(404).json({ error: "account_not_found" });
      return;
    }
    res.locals.account = account;
    next();
  }

  router.get("/accounts/:accountId/statements/latest", loadAccount, async (req, res, next) => {
    try {
      const account = res.locals.account;
      const previous = await repo.lastStatement(account.id);
      const periodStart = previous ? previous.periodEnd : new Date(0);
      const periodEnd = new Date();
      const [opening, closing, entries] = await Promise.all([
        repo.balanceAt(account.id, periodStart),
        repo.balanceAt(account.id, periodEnd),
        repo.entriesBetween(account.id, periodStart, periodEnd),
      ]);
      const statement: Statement = {
        id: randomUUID(),
        accountId: account.id,
        periodStart,
        periodEnd,
        openingBalanceMinor: opening,
        closingBalanceMinor: closing,
        entryCount: entries.length,
        createdAt: new Date(),
      };
      await repo.insertStatement(statement);
      res.json(toJson(statement, account.currency));
    } catch (err) {
      next(err);
    }
  });

  router.get("/accounts/:accountId/statements/:statementId", loadAccount, async (req, res, next) => {
    try {
      const account = res.locals.account;
      const statement = await repo.getStatement(account.id, req.params.statementId);
      if (!statement) return res.status(404).json({ error: "statement_not_found" });
      res.set("Cache-Control", "private, max-age=86400").json(toJson(statement, account.currency));
    } catch (err) {
      next(err);
    }
  });

  router.get("/accounts/:accountId/statements/:statementId/entries", loadAccount, async (req, res, next) => {
    try {
      const account = res.locals.account;
      const statement = await repo.getStatement(account.id, req.params.statementId);
      if (!statement) return res.status(404).json({ error: "statement_not_found" });
      const entries = await repo.entriesBetween(account.id, statement.periodStart, statement.periodEnd);
      res.json({
        statementId: statement.id,
        items: entries.map((e) => ({
          id: e.id,
          postedAt: e.postedAt.toISOString(),
          amount: e.amountMinor.toString(),
          description: e.description,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
