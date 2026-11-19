import { createHash } from "crypto";

export interface FlagDefinition {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  firmwareMin?: string;
}

export interface DeviceContext {
  deviceId: string;
  firmware: string;
}

export interface FlagSource {
  fetchAll(signal: AbortSignal): Promise<FlagDefinition[]>;
}

export interface Logger {
  warn(msg: string, fields: Record<string, unknown>): void;
}

export class TelemetryFlagClient {
  private snapshot: ReadonlyMap<string, FlagDefinition> = new Map();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly source: FlagSource,
    private readonly log: Logger,
    private readonly defaults: Readonly<Record<string, boolean>>,
    private readonly refreshMs = 30_000,
    private readonly fetchTimeoutMs = 2_000,
  ) {}

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.refreshMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh(): Promise<void> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.fetchTimeoutMs);
    try {
      const defs = await this.source.fetchAll(ac.signal);
      const next = new Map<string, FlagDefinition>();
      for (const d of defs) {
        if (!Number.isFinite(d.rolloutPercent) || d.rolloutPercent < 0 || d.rolloutPercent > 100) {
          this.log.warn("skipping invalid flag", { key: d.key, rolloutPercent: d.rolloutPercent });
          continue;
        }
        next.set(d.key, d);
      }
      this.snapshot = next;
    } catch (err) {
      this.log.warn("flag refresh failed; keeping last snapshot", {
        error: (err as Error).message,
        flags: this.snapshot.size,
      });
    } finally {
      clearTimeout(t);
    }
  }

  isEnabled(key: string, device: DeviceContext): boolean {
    const def = this.snapshot.get(key);
    if (!def) return this.defaults[key] ?? false;
    if (!def.enabled) return false;
    if (def.firmwareMin && compareVersions(device.firmware, def.firmwareMin) < 0) return false;
    return bucket(def.key, device.deviceId) < def.rolloutPercent;
  }
}

function bucket(flagKey: string, deviceId: string): number {
  const h = createHash("sha1").update(`${flagKey}/${deviceId}`).digest();
  return h.readUInt32BE(0) % 100;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
