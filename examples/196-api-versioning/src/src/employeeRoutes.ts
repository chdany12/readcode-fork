import express, { Router } from "express";
import { fromV1Create, fromV2Create, toV1, toV2, Employee } from "./employeeAdapters";
import { EmployeeStore } from "./employeeStore";

interface VersionAdapter {
  parseCreate(body: unknown): Omit<Employee, "id">;
  render(e: Employee): unknown;
}

const adapters: Record<"v1" | "v2", VersionAdapter> = {
  v1: { parseCreate: fromV1Create, render: toV1 },
  v2: { parseCreate: fromV2Create, render: toV2 },
};

function employeeRoutes(store: EmployeeStore, adapter: VersionAdapter, deprecated: boolean): Router {
  const r = express.Router();

  r.use((_req, res, next) => {
    if (deprecated) {
      res.setHeader("Deprecation", "true");
      res.setHeader("Link", '</v2/employees>; rel="successor-version"');
    }
    next();
  });

  r.post("/employees", async (req, res, next) => {
    try {
      const input = adapter.parseCreate(req.body);
      const created = await store.create(input);
      res.status(201).json(adapter.render(created));
    } catch (err) {
      if (err instanceof RangeError) return res.status(422).json({ error: err.message });
      next(err);
    }
  });

  r.get("/employees/:id", async (req, res, next) => {
    try {
      const e = await store.get(req.params.id);
      if (!e) return res.status(404).json({ error: "employee_not_found" });
      res.json(adapter.render(e));
    } catch (err) {
      next(err);
    }
  });

  return r;
}

export function mountPayrollApi(app: express.Express, store: EmployeeStore) {
  app.use("/v1", employeeRoutes(store, adapters.v1, true));
  app.use("/v2", employeeRoutes(store, adapters.v2, false));
}
