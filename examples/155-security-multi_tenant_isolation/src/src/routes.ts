import express, { NextFunction, Request, Response } from "express";
import { Pool } from "pg";
import { PostRepository } from "./postRepository";

interface Member {
  userId: string;
  communityId: string;
}

declare module "express-serve-static-core" {
  interface Request {
    member?: Member;
  }
}

export function buildRouter(db: Pool, verifySession: (token: string) => Promise<Member | null>) {
  const posts = new PostRepository(db);
  const router = express.Router();

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("authorization")?.replace(/^Bearer /, "");
    const member = token ? await verifySession(token) : null;
    if (!member) return res.status(401).json({ error: "unauthenticated" });
    req.member = member;
    next();
  });

  router.get("/feed", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const before = req.query.before ? new Date(String(req.query.before)) : new Date();
      if (Number.isNaN(before.getTime())) return res.status(400).json({ error: "invalid before" });
      const items = await posts.feed(req.member!.communityId, before, limit);
      const nextCursor = items.length === limit ? items[items.length - 1].createdAt.toISOString() : null;
      res.json({ items, nextCursor });
    } catch (err) {
      next(err);
    }
  });

  router.get("/posts/:id", async (req, res, next) => {
    try {
      const post = await posts.findById(req.member!.communityId, req.params.id);
      if (!post) return res.status(404).json({ error: "not found" });
      res.json(post);
    } catch (err) {
      next(err);
    }
  });

  router.post("/posts", express.json({ limit: "16kb" }), async (req, res, next) => {
    try {
      const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
      if (!body || body.length > 5000) return res.status(400).json({ error: "body must be 1-5000 chars" });
      const post = await posts.create(req.member!.communityId, req.member!.userId, body);
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
