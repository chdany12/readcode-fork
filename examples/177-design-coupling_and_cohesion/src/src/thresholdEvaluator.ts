import { AlertPublisher, AlertRule, RuleSource, TelemetryReading } from "./ports";

export function breaches(rule: AlertRule, value: number): boolean {
  if (rule.above !== undefined && value > rule.above) return true;
  if (rule.below !== undefined && value < rule.below) return true;
  return false;
}

export class ThresholdEvaluator {
  constructor(
    private readonly rules: RuleSource,
    private readonly publisher: AlertPublisher,
  ) {}

  async evaluate(readings: TelemetryReading[]): Promise<number> {
    const byDevice = new Map<string, TelemetryReading[]>();
    for (const r of readings) {
      const list = byDevice.get(r.deviceId) ?? [];
      list.push(r);
      byDevice.set(r.deviceId, list);
    }

    let fired = 0;
    for (const [deviceId, deviceReadings] of byDevice) {
      const rules = await this.rules.rulesFor(deviceId);
      for (const reading of deviceReadings) {
        for (const rule of rules) {
          if (rule.metric === reading.metric && breaches(rule, reading.value)) {
            await this.publisher.publish({ deviceId, metric: reading.metric, value: reading.value, rule });
            fired++;
          }
        }
      }
    }
    return fired;
  }
}
