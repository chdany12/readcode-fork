import express from "express";
import { readFileSync } from "fs";
import Redis from "ioredis";
import { requireDriver, DriverRequest } from "./requireDriver";
import { DriverDirectory } from "./driverDirectory";
import { dispatch } from "./dispatch";

const cfg = {
  publicKey: readFileSync(process.env.DRIVER_JWT_PUBLIC_KEY_PATH!, "utf8"),
  issuer: "https://auth.rides.internal",
  audience: "dispatch-api",
  clockToleranceSec: 30,
};

const directory = new DriverDirectory(new Redis(process.env.REDIS_URL!));
const app = express();
app.use(express.json());

app.post("/v1/trips/:tripId/accept", requireDriver(cfg, directory), async (req: DriverRequest, res) => {
  const result = await dispatch.acceptTrip(req.params.tripId, req.driver!.driverId);
  if (!result.ok) return res.status(409).json({ error: result.reason });
  res.json(result.trip);
});

app.post("/v1/drivers/me/logout", requireDriver(cfg, directory), async (req: DriverRequest, res) => {
  await directory.revoke(req.driver!.driverId, req.driver!.sessionId);
  res.status(204).end();
});

export default app;
