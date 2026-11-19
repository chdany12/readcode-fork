import { Router } from "express";
import { StorefrontLoginService } from "./loginService";

export function authRoutes(login: StorefrontLoginService): Router {
  const router = Router();

  router.post("/auth/login", async (req, res, next) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "email_and_password_required" });
    }
    try {
      const result = await login.login(email, password);
      if (!result.ok) {
        const status = result.reason === "locked" ? 423 : 401;
        return res.status(status).json({ error: result.reason });
      }
      res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
