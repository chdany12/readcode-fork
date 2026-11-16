import { performance } from "node:perf_hooks";
import { renderInvoice } from "./render";
import { Invoice, RenderedInvoice } from "./types";

export interface BatchResult {
  rendered: RenderedInvoice[];
  failed: { invoiceId: string; error: string }[];
  p95Ms: number;
}

export function renderBatch(invoices: Invoice[]): BatchResult {
  const rendered: RenderedInvoice[] = [];
  const failed: BatchResult["failed"] = [];
  const timings: number[] = [];

  for (const inv of invoices) {
    const start = performance.now();
    try {
      rendered.push(renderInvoice(inv));
    } catch (err) {
      failed.push({ invoiceId: inv.id, error: err instanceof Error ? err.message : String(err) });
    } finally {
      timings.push(performance.now() - start);
    }
  }

  timings.sort((a, b) => a - b);
  const idx = Math.min(timings.length - 1, Math.floor(timings.length * 0.95));
  return { rendered, failed, p95Ms: timings.length ? timings[idx] : 0 };
}
