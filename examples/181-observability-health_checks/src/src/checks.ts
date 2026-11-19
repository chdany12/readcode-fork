export type CheckStatus = "pass" | "fail";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  critical: boolean;
  latencyMs: number;
  error?: string;
}

export interface DependencyCheck {
  name: string;
  critical: boolean;
  run(signal: AbortSignal): Promise<void>;
}

export async function runCheck(check: DependencyCheck, timeoutMs: number): Promise<CheckResult> {
  const controller = new AbortController();
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([check.run(controller.signal), timeout]);
    return { name: check.name, status: "pass", critical: check.critical, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      name: check.name,
      status: "fail",
      critical: check.critical,
      latencyMs: Date.now() - started,
      error: (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}
