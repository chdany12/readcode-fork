export interface Employee {
  id: string;
  fullName: string;
  annualSalaryCents: number;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  department: string;
  startDate: string;
}

export interface EmployeeV1 {
  id: string;
  name: string;
  salary: number;
  payFrequency: "biweekly" | "monthly";
  department: string;
  startDate: string;
}

export interface EmployeeV2 {
  id: string;
  fullName: string;
  compensation: { annualSalaryCents: number; currency: "USD"; payFrequency: Employee["payFrequency"] };
  department: string;
  startDate: string;
}

export function fromV1Create(body: any): Omit<Employee, "id"> {
  if (typeof body.salary !== "number" || body.salary <= 0) {
    throw new RangeError("salary must be a positive number of dollars");
  }
  return {
    fullName: String(body.name),
    annualSalaryCents: Math.round(body.salary * 100),
    payFrequency: body.payFrequency === "monthly" ? "monthly" : "biweekly",
    department: String(body.department),
    startDate: String(body.startDate),
  };
}

export function fromV2Create(body: any): Omit<Employee, "id"> {
  const c = body.compensation ?? {};
  if (!Number.isInteger(c.annualSalaryCents) || c.annualSalaryCents <= 0) {
    throw new RangeError("compensation.annualSalaryCents must be a positive integer");
  }
  return {
    fullName: String(body.fullName),
    annualSalaryCents: c.annualSalaryCents,
    payFrequency: c.payFrequency,
    department: String(body.department),
    startDate: String(body.startDate),
  };
}

export function toV1(e: Employee): EmployeeV1 {
  return {
    id: e.id,
    name: e.fullName,
    salary: e.annualSalaryCents,
    payFrequency: e.payFrequency === "monthly" || e.payFrequency === "semimonthly" ? "monthly" : "biweekly",
    department: e.department,
    startDate: e.startDate,
  };
}

export function toV2(e: Employee): EmployeeV2 {
  return {
    id: e.id,
    fullName: e.fullName,
    compensation: { annualSalaryCents: e.annualSalaryCents, currency: "USD", payFrequency: e.payFrequency },
    department: e.department,
    startDate: e.startDate,
  };
}
