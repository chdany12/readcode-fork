import os from "os";
import path from "path";
import { InvoiceWorkerPool, InvoiceJob } from "./invoicePool";

const pool = new InvoiceWorkerPool(
  path.join(__dirname, "invoiceWorker.js"),
  Math.max(1, os.cpus().length - 1),
);
pool.on("workerError", (err) => console.error(JSON.stringify({ msg: "invoice worker crashed", err: String(err) })));

export async function finalizeBillingRun(jobs: InvoiceJob[]) {
  const results = await Promise.allSettled(jobs.map((j) => pool.compute(j)));
  const failed = results.filter((r) => r.status === "rejected").length;
  return {
    finalized: results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    failed,
  };
}

process.on("SIGTERM", () => {
  void pool.close();
});
