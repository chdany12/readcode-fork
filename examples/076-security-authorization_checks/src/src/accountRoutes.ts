import { Router, Request, Response, NextFunction } from "express";
import { AccountRepo, TransferService } from "./ledger";
import { AuthedUser } from "./auth";

type AuthedRequest = Request & { user: AuthedUser };

export function accountRoutes(accounts: AccountRepo, transfers: TransferService): Router {
  const router = Router();

  router.get("/accounts/:accountId/balance", async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const account = await accounts.findById(req.params.accountId);
      if (!account || !canView(user, account.customerId)) {
        return res.status(404).json({ error: "account_not_found" });
      }
      res.json({ accountId: account.id, balanceMinor: account.balanceMinor, currency: account.currency });
    } catch (err) {
      next(err);
    }
  });

  router.post("/transfers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthedRequest).user;
      const { fromAccountId, toAccountId, amountMinor, idempotencyKey } = req.body ?? {};
      if (
        typeof fromAccountId !== "string" ||
        typeof toAccountId !== "string" ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0 ||
        typeof idempotencyKey !== "string"
      ) {
        return res.status(400).json({ error: "invalid_request" });
      }
      if (fromAccountId === toAccountId) {
        return res.status(400).json({ error: "same_account" });
      }

      const [from, to] = await Promise.all([
        accounts.findById(fromAccountId),
        accounts.findById(toAccountId),
      ]);
      if (!from || !to) {
        return res.status(404).json({ error: "account_not_found" });
      }
      if (from.customerId !== user.customerId && to.customerId !== user.customerId) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (from.currency !== to.currency) {
        return res.status(422).json({ error: "currency_mismatch" });
      }
      if (from.frozen) {
        return res.status(423).json({ error: "account_frozen" });
      }

      const result = await transfers.execute({
        fromAccountId,
        toAccountId,
        amountMinor,
        currency: from.currency,
        idempotencyKey,
        initiatedBy: user.customerId,
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function canView(user: AuthedUser, ownerCustomerId: string): boolean {
  return user.roles.includes("support_agent") || user.customerId === ownerCustomerId;
}
