import { createIngestServer } from "./ingestServer";
import { ImpressionBatcher, WarehouseSink } from "./impressionBatcher";

const SHUTDOWN_DEADLINE_MS = 20_000;

export function main(sink: WarehouseSink) {
  const batcher = new ImpressionBatcher(sink);
  batcher.start();
  const server = createIngestServer(batcher);
  server.keepAliveTimeout = 5_000;
  server.listen(Number(process.env.PORT ?? 8080));

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`received ${signal}, draining`);
    const killer = setTimeout(() => {
      console.error("shutdown deadline exceeded, exiting");
      process.exit(1);
    }, SHUTDOWN_DEADLINE_MS);
    killer.unref();

    await batcher.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server.closeIdleConnections();

    clearTimeout(killer);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
