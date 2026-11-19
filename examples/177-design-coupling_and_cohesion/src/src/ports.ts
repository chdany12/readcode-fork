export interface TelemetryReading {
  deviceId: string;
  metric: string;
  value: number;
  ts: number;
}

export interface ReadingStore {
  append(readings: TelemetryReading[]): Promise<void>;
}

export interface AlertRule {
  metric: string;
  above?: number;
  below?: number;
}

export interface AlertPublisher {
  publish(alert: { deviceId: string; metric: string; value: number; rule: AlertRule }): Promise<void>;
}

export interface RuleSource {
  rulesFor(deviceId: string): Promise<AlertRule[]>;
}
