import http from "node:http";
import { HealthService } from "./healthService";
import { DependencyCheck } from "./checks";

export interface Pinger {
  ping(signal: AbortSignal): Promise<void>;
}

export function buildChecks(clickhouse: Pinger, kafka: Pinger, geoIpCache: Pinger): DependencyCheck[] {
  return [
    { name: "clickhouse", critical: true, run: (s) => clickhouse.ping(s) },
    { name: "kafka_producer", critical: true, run: (s) => kafka.ping(s) },
    { name: "geoip_cache", critical: false, run: (s) => geoIpCache.ping(s) },
  ];
}

export function startHealthServer(health: HealthService, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    let result;
    if (req.url === "/healthz/live") {
      result = health.liveness();
    } else if (req.url === "/healthz/ready") {
      result = await health.readiness();
    } else {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(result.status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(result.body));
  });

  process.once("SIGTERM", () => {
    health.markShuttingDown();
  });

  return server.listen(port);
}
