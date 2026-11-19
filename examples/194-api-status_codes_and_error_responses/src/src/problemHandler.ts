import { Request, Response, NextFunction } from "express";

interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

type Mapper = (err: any) => { problem: Omit<Problem, "instance">; headers?: Record<string, string> };

const mappers: Record<string, Mapper> = {
  ShipmentNotFoundError: (err) => ({
    problem: { type: "/problems/shipment-not-found", title: "Shipment not found", status: 404, detail: err.message },
  }),
  InvalidStateTransitionError: (err) => ({
    problem: {
      type: "/problems/invalid-transition",
      title: "Shipment cannot change to the requested state",
      status: 409,
      detail: `${err.from} -> ${err.to} is not allowed`,
    },
  }),
  AddressRejectedError: (err) => ({
    problem: { type: "/problems/address-rejected", title: "Address rejected", status: 422, detail: err.reason },
  }),
  CarrierUnavailableError: (err) => ({
    problem: {
      type: "/problems/carrier-unavailable",
      title: "Carrier temporarily unavailable",
      status: 503,
      detail: `carrier ${err.carrier} did not respond`,
    },
    headers: { "Retry-After": String(err.retryAfterSeconds) },
  }),
};

export function problemHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  const name = err instanceof Error ? err.name : "";
  const mapper = mappers[name];

  if (!mapper) {
    console.error("unmapped error", { path: req.path, err });
    res.status(500).type("application/problem+json").json({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      instance: req.originalUrl,
    });
    return;
  }

  const { problem, headers } = mapper(err);
  for (const [k, v] of Object.entries(headers ?? {})) res.setHeader(k, v);
  res.status(problem.status).type("application/problem+json").json({ ...problem, instance: req.originalUrl });
}
