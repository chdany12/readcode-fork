import { ReadingStore, TelemetryReading } from "./ports";
import { ThresholdEvaluator } from "./thresholdEvaluator";

export class InvalidReadingError extends Error {}

export function parseReading(raw: unknown): TelemetryReading {
  const r = raw as Partial<TelemetryReading>;
  if (typeof r?.deviceId !== "string" || r.deviceId.length === 0) {
    throw new InvalidReadingError("deviceId is required");
  }
  if (typeof r.metric !== "string" || typeof r.value !== "number" || !Number.isFinite(r.value)) {
    throw new InvalidReadingError(`bad metric or value for ${r.deviceId}`);
  }
  if (typeof r.ts !== "number") {
    throw new InvalidReadingError(`missing ts for ${r.deviceId}`);
  }
  return { deviceId: r.deviceId, metric: r.metric, value: r.value, ts: r.ts };
}

export class TelemetryIngestService {
  constructor(
    private readonly store: ReadingStore,
    private readonly evaluator: ThresholdEvaluator,
  ) {}

  async ingest(rawBatch: unknown[]): Promise<{ accepted: number; rejected: number; alerts: number }> {
    const accepted: TelemetryReading[] = [];
    let rejected = 0;
    for (const raw of rawBatch) {
      try {
        accepted.push(parseReading(raw));
      } catch (err) {
        if (!(err instanceof InvalidReadingError)) throw err;
        rejected++;
      }
    }
    if (accepted.length === 0) return { accepted: 0, rejected, alerts: 0 };

    await this.store.append(accepted);
    const alerts = await this.evaluator.evaluate(accepted);
    return { accepted: accepted.length, rejected, alerts };
  }
}
