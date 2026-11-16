import { readFileSync } from "node:fs";

export interface PayoutConfig {
  baseUrl: string;
  apiKey: string;
  signingSecret: string;
  timeoutMs: number;
}

function readSecretFile(envVar: string): string {
  const filePath = process.env[envVar];
  if (!filePath) throw new Error(`${envVar} is not set`);
  const value = readFileSync(filePath, "utf8").trim();
  if (value.length < 16) throw new Error(`${envVar} points to an empty or truncated secret`);
  return value;
}

export function loadPayoutConfig(): PayoutConfig {
  const baseUrl = process.env.PAYOUT_BASE_URL;
  if (!baseUrl || !baseUrl.startsWith("https://")) {
    throw new Error("PAYOUT_BASE_URL must be an https URL");
  }
  const timeoutMs = Number(process.env.PAYOUT_TIMEOUT_MS ?? "8000");
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("PAYOUT_TIMEOUT_MS must be a positive integer");
  }
  return {
    baseUrl,
    apiKey: readSecretFile("PAYOUT_API_KEY_FILE"),
    signingSecret: readSecretFile("PAYOUT_SIGNING_SECRET_FILE"),
    timeoutMs,
  };
}
