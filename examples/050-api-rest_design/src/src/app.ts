import express from "express";
import { Pool } from "pg";
import { ParcelRepository } from "./parcelRepository";
import { parcelRoutes } from "./parcelRoutes";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const merchantId = req.header("X-Merchant-Id");
  if (!merchantId) return res.status(401).json({ error: "missing merchant" });
  res.locals.merchantId = merchantId;
  next();
});

app.use("/shipments/:shipmentId/parcels", parcelRoutes(new ParcelRepository(pool)));

app.listen(Number(process.env.PORT ?? 8080));
