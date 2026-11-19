import { probeRelay, ProbeResult, RelayEndpoint } from "./relayProbe";

export interface RelayRegistry {
  list(): RelayEndpoint[];
  markHealth(endpoint: RelayEndpoint, healthy: boolean, rttMs?: number): void;
}

export interface MonitorOptions {
  intervalMs: number;
  probeTimeoutMs: number;
  maxConcurrentProbes: number;
}

export class RelayHealthMonitor {
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(private readonly registry: RelayRegistry, private readonly opts: MonitorOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sweep(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async sweep(): Promise<ProbeResult[]> {
    if (this.sweeping) return [];
    this.sweeping = true;
    try {
      const endpoints = this.registry.list();
      const results: ProbeResult[] = [];
      let next = 0;
      const worker = async () => {
        while (next < endpoints.length) {
          const ep = endpoints[next++];
          const r = await probeRelay(ep, this.opts.probeTimeoutMs);
          this.registry.markHealth(r.endpoint, r.healthy, r.rttMs);
          results.push(r);
        }
      };
      const n = Math.min(this.opts.maxConcurrentProbes, endpoints.length);
      await Promise.all(Array.from({ length: n }, worker));
      return results;
    } finally {
      this.sweeping = false;
    }
  }
}
