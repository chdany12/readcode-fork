import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { Appointment, AppointmentStore } from "./appointmentStore";

const EDITABLE = ["startsAt", "durationMinutes", "reason", "notes"] as const;

export function appointmentRouter(store: AppointmentStore) {
  const router = express.Router();

  router.get("/providers/:providerId/appointments", async (req: Request, res: Response) => {
    const day = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ error: "date query parameter must be YYYY-MM-DD" });
    }
    const items = await store.listForProvider(req.params.providerId, day);
    res.json({ items });
  });

  router.post("/appointments", async (req: Request, res: Response) => {
    const { patientId, providerId, startsAt, durationMinutes, reason } = req.body ?? {};
    if (!patientId || !providerId || !startsAt || !durationMinutes) {
      return res.status(400).json({ error: "patientId, providerId, startsAt, durationMinutes are required" });
    }
    const appt: Appointment = {
      id: randomUUID(),
      patientId,
      providerId,
      startsAt,
      durationMinutes,
      reason: reason ?? "",
      notes: null,
      status: "booked",
      version: 1,
    };
    await store.save(appt);
    res.status(201).location(`/appointments/${appt.id}`).json(appt);
  });

  router.get("/appointments/:id", async (req: Request, res: Response) => {
    const appt = await store.get(req.params.id);
    if (!appt) return res.status(404).json({ error: "appointment not found" });
    res.set("ETag", `"${appt.version}"`).json(appt);
  });

  router.patch("/appointments/:id", async (req: Request, res: Response) => {
    const current = await store.get(req.params.id);
    if (!current) return res.status(404).json({ error: "appointment not found" });
    if (current.status === "cancelled" || current.status === "completed") {
      return res.status(409).json({ error: `cannot edit a ${current.status} appointment` });
    }
    const ifMatch = req.header("If-Match");
    if (ifMatch && ifMatch !== `"${current.version}"`) {
      return res.status(412).json({ error: "appointment was modified" });
    }
    const body = req.body ?? {};
    const unknown = Object.keys(body).filter((k) => !(EDITABLE as readonly string[]).includes(k));
    if (unknown.length > 0) {
      return res.status(400).json({ error: `fields not editable: ${unknown.join(", ")}` });
    }
    const changes: Partial<Appointment> = {};
    for (const field of EDITABLE) {
      (changes as any)[field] = body[field];
    }
    const updated: Appointment = { ...current, ...changes, version: current.version + 1 };
    await store.save(updated);
    res.set("ETag", `"${updated.version}"`).json(updated);
  });

  router.post("/appointments/:id/cancellation", async (req: Request, res: Response) => {
    const current = await store.get(req.params.id);
    if (!current) return res.status(404).json({ error: "appointment not found" });
    if (current.status === "cancelled") return res.status(200).json(current);
    if (current.status !== "booked") {
      return res.status(409).json({ error: `cannot cancel a ${current.status} appointment` });
    }
    const updated: Appointment = { ...current, status: "cancelled", version: current.version + 1 };
    await store.save(updated);
    res.status(200).json(updated);
  });

  return router;
}
