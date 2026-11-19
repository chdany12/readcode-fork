import type { Request, Response } from "express";
import { startUploadSchema, type StartUploadRequest } from "./uploadSchema";

export interface SyncStore {
  currentRevision(driveId: string, path: string): Promise<number | null>;
  createUploadSession(driveId: string, req: StartUploadRequest): Promise<{ uploadId: string; uploadUrl: string }>;
}

export function startUploadHandler(store: SyncStore) {
  return async (req: Request, res: Response) => {
    const driveId = req.params.driveId;
    const parsed = startUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
      return;
    }
    const body = parsed.data;

    const current = await store.currentRevision(driveId, body.path);
    if (body.baseRevision !== current && body.conflictPolicy === "fail") {
      res.status(409).json({ error: "revision_conflict", currentRevision: current });
      return;
    }

    const session = await store.createUploadSession(driveId, body);
    res.status(201).json(session);
  };
}
