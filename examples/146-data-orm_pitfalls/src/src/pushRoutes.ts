import { PushService, DirectPushRequest } from "./pushService";

export interface Req { body: unknown; auth: { service: string } | null; }
export interface Res { status: number; json: unknown; }

export async function handleDirectPush(svc: PushService, req: Req): Promise<Res> {
  if (!req.auth) return { status: 401, json: { error: "unauthenticated" } };
  const b = (req.body ?? {}) as Partial<DirectPushRequest>;
  if (typeof b.title !== "string" || typeof b.body !== "string") {
    return { status: 400, json: { error: "title and body are required" } };
  }
  if (b.title.length > 120 || b.body.length > 1000) {
    return { status: 400, json: { error: "payload too long" } };
  }
  const sent = await svc.notifyInstall({ installId: b.installId, title: b.title, body: b.body });
  return sent ? { status: 202, json: { status: "queued" } } : { status: 404, json: { error: "device_not_found" } };
}

export async function handleUserPush(svc: PushService, userId: string, req: Req): Promise<Res> {
  if (!req.auth) return { status: 401, json: { error: "unauthenticated" } };
  const b = (req.body ?? {}) as { title?: unknown; body?: unknown };
  if (typeof b.title !== "string" || typeof b.body !== "string") {
    return { status: 400, json: { error: "title and body are required" } };
  }
  const delivered = await svc.notifyUser(userId, b.title, b.body);
  return { status: 202, json: { delivered } };
}
