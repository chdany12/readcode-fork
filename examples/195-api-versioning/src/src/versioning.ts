import { Request, Response, NextFunction } from "express";

export const SUPPORTED_VERSIONS = ["2023-06-01", "2024-09-15"] as const;
export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];

const DEFAULT_VERSION: ApiVersion = "2023-06-01";
const SUNSET: Partial<Record<ApiVersion, string>> = {
  "2023-06-01": "Wed, 01 Oct 2025 00:00:00 GMT",
};

declare global {
  namespace Express {
    interface Request {
      apiVersion: ApiVersion;
    }
  }
}

export function resolveVersion(req: Request, res: Response, next: NextFunction) {
  const requested = req.header("Support-Api-Version");
  const version = requested ?? DEFAULT_VERSION;

  if (!(SUPPORTED_VERSIONS as readonly string[]).includes(version)) {
    res.status(400).json({
      error: "unsupported_api_version",
      requested: version,
      supported: SUPPORTED_VERSIONS,
    });
    return;
  }

  req.apiVersion = version as ApiVersion;
  res.setHeader("Support-Api-Version", version);
  res.vary("Support-Api-Version");

  const sunset = SUNSET[req.apiVersion];
  if (sunset) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", sunset);
    res.setHeader("Link", '</docs/migrations/2024-09-15>; rel="successor-version"');
  }
  next();
}
