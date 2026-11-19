import { parentPort } from "worker_threads";
import type { InvoiceJob, InvoiceTotals } from "./invoicePool";

parentPort!.on("message", (job: InvoiceJob) => {
  let subtotal = 0;
  let tax = 0;
  for (const line of job.lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new Error(`invalid quantity for ${line.sku} on ${job.invoiceId}`);
    }
    const amount = line.qty * line.unitCents;
    subtotal += amount;
    tax += Math.round(amount * line.taxRate);
  }
  const totals: InvoiceTotals = {
    invoiceId: job.invoiceId,
    subtotalCents: subtotal,
    taxCents: tax,
    totalCents: subtotal + tax,
  };
  parentPort!.postMessage(totals);
});
