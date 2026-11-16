import express from "express";
import { merchantSignatureAuth, AuthenticatedRequest } from "./signatureAuth";
import { PgMerchantKeyStore } from "./merchantKeys";
import { pool } from "./db";
import { createCharge } from "./charges";

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as AuthenticatedRequest).rawBody = Buffer.from(buf);
    },
  })
);

const auth = merchantSignatureAuth(new PgMerchantKeyStore(pool));

app.post("/v1/charges", auth, async (req: AuthenticatedRequest, res) => {
  const charge = await createCharge(req.merchantId!, req.body);
  res.status(201).json(charge);
});

export default app;
