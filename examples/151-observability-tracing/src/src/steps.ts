import { spawn } from "node:child_process";
import { context, propagation } from "@opentelemetry/api";

export interface StepResult {
  exitCode: number;
  durationMs: number;
}

export function runStep(command: string, timeoutMs: number): Promise<StepResult> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  if (carrier.traceparent) env.TRACEPARENT = carrier.traceparent;
  if (carrier.tracestate) env.TRACESTATE = carrier.tracestate;

  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/sh", ["-c", command], { env, stdio: "inherit" });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);

    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? (signal ? 137 : 1), durationMs: Date.now() - started });
    });
  });
}
