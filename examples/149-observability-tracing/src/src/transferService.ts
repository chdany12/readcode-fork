import { SpanStatusCode, trace } from "@opentelemetry/api";
import { LedgerClient, PostingRequest } from "./ledgerClient";

const tracer = trace.getTracer("payments-transfer", "2.3.0");

export interface TransferStore {
  reserve(transferId: string, accountId: string, amountMinor: bigint): Promise<void>;
  markPosted(transferId: string, journalId: string): Promise<void>;
  release(transferId: string): Promise<void>;
}

export class TransferService {
  constructor(private readonly store: TransferStore, private readonly ledger: LedgerClient) {}

  async execute(req: PostingRequest): Promise<string> {
    return tracer.startActiveSpan("transfer.execute", async (span) => {
      span.setAttributes({
        "transfer.id": req.transferId,
        "transfer.currency": req.currency,
      });
      try {
        await tracer.startActiveSpan("transfer.reserve_funds", async (child) => {
          try {
            await this.store.reserve(req.transferId, req.debitAccount, req.amountMinor);
          } finally {
            child.end();
          }
        });

        let journalId: string;
        try {
          ({ journalId } = await this.ledger.post(req));
        } catch (err) {
          span.addEvent("transfer.reservation_released");
          await this.store.release(req.transferId);
          throw err;
        }

        await this.store.markPosted(req.transferId, journalId);
        return journalId;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
