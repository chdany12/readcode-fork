import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  AccountFrozenError,
  AccountNotFoundError,
  InsufficientFundsError,
  ValidationError,
} from "./errors";
import { LedgerService } from "./ledgerService";

interface TransferBody {
  fromAccountId?: string;
  toAccountId?: string;
  amountMinor?: string;
  currency?: string;
}

function parseTransfer(body: TransferBody) {
  if (!body.fromAccountId) throw new ValidationError("fromAccountId", "fromAccountId is required");
  if (!body.toAccountId) throw new ValidationError("toAccountId", "toAccountId is required");
  if (body.fromAccountId === body.toAccountId) {
    throw new ValidationError("toAccountId", "cannot transfer to the same account");
  }
  if (!body.amountMinor || !/^[1-9][0-9]*$/.test(body.amountMinor)) {
    throw new ValidationError("amountMinor", "amountMinor must be a positive integer string");
  }
  if (!body.currency || !/^[A-Z]{3}$/.test(body.currency)) {
    throw new ValidationError("currency", "currency must be an ISO 4217 code");
  }
  return {
    fromAccountId: body.fromAccountId,
    toAccountId: body.toAccountId,
    amountMinor: BigInt(body.amountMinor),
    currency: body.currency,
  };
}

export function transferRouter(ledger: LedgerService) {
  const router = express.Router();

  router.post("/transfers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = parseTransfer(req.body as TransferBody);
      const result = await ledger.transfer(transfer);
      res.status(201).location(`/transfers/${result.transferId}`).json({
        transferId: result.transferId,
        status: result.status,
        postedAt: result.postedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/accounts/:id/balance", async (req, res, next) => {
    try {
      const balance = await ledger.getBalance(req.params.id);
      res.json({ accountId: req.params.id, availableMinor: balance.toString() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function ledgerErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  res.setHeader("x-request-id", requestId);

  if (err instanceof ValidationError) {
    return res.status(422).json({ error: "validation_failed", field: err.field, message: err.message, requestId });
  }
  if (err instanceof AccountNotFoundError) {
    return res.status(404).json({ error: "account_not_found", accountId: err.accountId, requestId });
  }
  if (err instanceof InsufficientFundsError) {
    return res.status(409).json({ error: "insufficient_funds", accountId: err.accountId, requestId });
  }
  if (err instanceof AccountFrozenError) {
    return res.status(403).json({ error: "account_frozen", accountId: err.accountId, requestId });
  }

  console.error(JSON.stringify({ msg: "unhandled ledger error", requestId, err: String(err) }));
  return res.status(400).json({ error: "request_failed", message: "the transfer could not be completed", requestId });
}
