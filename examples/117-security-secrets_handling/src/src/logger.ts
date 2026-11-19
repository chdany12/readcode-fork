import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "res.headers['set-cookie']"],
  base: { service: "dispatch-payouts" },
});
