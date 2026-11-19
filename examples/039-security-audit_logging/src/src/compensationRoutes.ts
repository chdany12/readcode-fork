import express, { Request, Response, NextFunction } from "express";
import { PayrollAuditTrail } from "./payrollAudit";

export interface Employee {
  id: string;
  baseSalary: number;
  bankAccount: string;
  taxCode: string;
  payGrade: string;
}

export interface EmployeeRepo {
  get(id: string): Promise<Employee | null>;
  updateField(id: string, field: keyof Employee, value: string | number): Promise<void>;
}

interface AuthedRequest extends Request {
  user?: { id: string; roles: string[] };
}

const EDITABLE = ["baseSalary", "bankAccount", "taxCode", "payGrade"] as const;
type EditableField = (typeof EDITABLE)[number];

export function compensationRouter(repo: EmployeeRepo, audit: PayrollAuditTrail) {
  const router = express.Router();

  router.use((req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.roles.includes("payroll_admin")) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  });

  router.patch("/employees/:id/compensation", async (req: AuthedRequest, res: Response) => {
    const { field, value, reason, changedBy } = req.body ?? {};
    if (!EDITABLE.includes(field)) {
      return res.status(400).json({ error: "unsupported field" });
    }
    if (typeof reason !== "string" || reason.trim().length < 10) {
      return res.status(400).json({ error: "a reason of at least 10 characters is required" });
    }
    if (field === "baseSalary" && (typeof value !== "number" || value <= 0)) {
      return res.status(400).json({ error: "invalid salary" });
    }

    const employee = await repo.get(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "employee not found" });
    }

    const f = field as EditableField;
    const oldValue = String(employee[f]);
    await repo.updateField(employee.id, f, value);

    await audit.write({
      actorUserId: changedBy ?? req.user!.id,
      employeeId: employee.id,
      field: f,
      oldValue,
      newValue: String(value),
      reason: reason.trim(),
      sourceIp: req.ip ?? "unknown",
    });

    res.status(204).end();
  });

  return router;
}
