import { context, propagation, ROOT_CONTEXT, SpanStatusCode, trace, type Link, type Span } from "@opentelemetry/api";
import { runStep, type StepResult } from "./steps";

const tracer = trace.getTracer("ci-runner", "4.1.0");

export interface PipelineJob {
  jobId: string;
  repo: string;
  commitSha: string;
  steps: { name: string; command: string; timeoutSec: number }[];
  triggerHeaders: Record<string, string>;
  coalescedTriggers: Record<string, string>[];
}

function linksFor(triggers: Record<string, string>[]): Link[] {
  const links: Link[] = [];
  for (const headers of triggers) {
    const sc = trace.getSpanContext(propagation.extract(ROOT_CONTEXT, headers));
    if (sc && trace.isSpanContextValid(sc)) {
      links.push({ context: sc, attributes: { "ci.link.reason": "coalesced_push" } });
    }
  }
  return links;
}

export async function runJob(job: PipelineJob): Promise<"passed" | "failed"> {
  const parent = propagation.extract(ROOT_CONTEXT, job.triggerHeaders);

  return context.with(parent, () =>
    tracer.startActiveSpan(
      "ci.job",
      {
        links: linksFor(job.coalescedTriggers),
        attributes: { "ci.job.id": job.jobId, "vcs.repository": job.repo, "vcs.revision": job.commitSha },
      },
      async (jobSpan: Span) => {
        let outcome: "passed" | "failed" = "passed";
        try {
          for (const step of job.steps) {
            const result: StepResult = await tracer.startActiveSpan(
              `ci.step ${step.name}`,
              { attributes: { "ci.step.timeout_sec": step.timeoutSec } },
              async (stepSpan) => {
                try {
                  const r = await runStep(step.command, step.timeoutSec * 1000);
                  stepSpan.setAttribute("process.exit.code", r.exitCode);
                  if (r.exitCode !== 0) {
                    stepSpan.setStatus({ code: SpanStatusCode.ERROR, message: `exit ${r.exitCode}` });
                  }
                  return r;
                } catch (err) {
                  stepSpan.recordException(err as Error);
                  stepSpan.setStatus({ code: SpanStatusCode.ERROR });
                  throw err;
                } finally {
                  stepSpan.end();
                }
              },
            );
            if (result.exitCode !== 0) {
              outcome = "failed";
              break;
            }
          }
        } catch (err) {
          outcome = "failed";
          jobSpan.recordException(err as Error);
        } finally {
          jobSpan.setAttribute("ci.job.outcome", outcome);
          if (outcome === "failed") jobSpan.setStatus({ code: SpanStatusCode.ERROR });
          jobSpan.end();
        }
        return outcome;
      },
    ),
  );
}
