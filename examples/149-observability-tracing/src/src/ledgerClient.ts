import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("payments-transfer", "2.3.0");

export interface LedgerClientOptions {
  baseUrl: string;
  timeoutMs: number;
}

export interface PostingRequest {
  transferId: string;
  debitAccount: string;
  creditAccount: string;
  amountMinor: bigint;
  currency: string;
}

export class LedgerClient {
  constructor(private readonly opts: LedgerClientOptions) {}

  async post(req: PostingRequest): Promise<{ journalId: string }> {
    return tracer.startActiveSpan(
      "ledger.post_journal",
      { kind: SpanKind.CLIENT, attributes: { "transfer.id": req.transferId, "ledger.currency": req.currency } },
      async (span) => {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "idempotency-key": req.transferId,
        };
        propagation.inject(context.active(), headers);

        const res = await fetch(`${this.opts.baseUrl}/v1/journals`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...req, amountMinor: req.amountMinor.toString() }),
          signal: AbortSignal.timeout(this.opts.timeoutMs),
        });
        span.setAttribute("http.response.status_code", res.status);

        if (!res.ok) {
          const msg = `ledger responded ${res.status}`;
          span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
          span.end();
          throw new Error(msg);
        }
        const body = (await res.json()) as { journalId: string };
        span.setAttribute("ledger.journal_id", body.journalId);
        span.end();
        return body;
      },
    );
  }
}
