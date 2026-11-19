import express from "express";
import { Pool } from "pg";
import { ehrGatewayProbe, postgresProbe } from "./dependencies";
import { healthRouter, HealthState } from "./healthRoutes";

export async function startSchedulingApi(port: number): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  const state: HealthState = { startedAt: Date.now(), migrationsApplied: false, draining: false };
  const log = (o: object) => console.log(JSON.stringify({ svc: "appointments", ...o }));

  const probes = [
    postgresProbe(pool, 1_000),
    ehrGatewayProbe(process.env.EHR_GATEWAY_URL ?? "http://ehr-gateway:8080", 1_500),
  ];

  const app = express();
  app.use(healthRouter(state, probes, log));

  const server = app.listen(port, () => log({ msg: "listening", port }));

  await pool.query("SELECT pg_advisory_lock(42)");
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS appointments (id uuid PRIMARY KEY, patient_id uuid NOT NULL, slot_start timestamptz NOT NULL)");
  } finally {
    await pool.query("SELECT pg_advisory_unlock(42)");
  }
  state.migrationsApplied = true;

  process.once("SIGTERM", () => {
    state.draining = true;
    setTimeout(() => {
      server.close(() => pool.end().finally(() => process.exit(0)));
    }, 10_000);
  });
}
