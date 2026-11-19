import { Pool } from "pg";

export interface Probe {
  name: string;
  check(): Promise<void>;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function postgresProbe(pool: Pool, timeoutMs: number): Probe {
  return {
    name: "postgres",
    check: async () => {
      await withTimeout(pool.query("SELECT 1"), timeoutMs, "postgres");
    },
  };
}

export function ehrGatewayProbe(baseUrl: string, timeoutMs: number): Probe {
  return {
    name: "ehr_gateway",
    check: async () => {
      const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        throw new Error(`ehr_gateway returned ${res.status}`);
      }
    },
  };
}
