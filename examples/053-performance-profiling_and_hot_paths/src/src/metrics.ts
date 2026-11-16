export interface Metrics {
  observe(name: string, value: number, labels: Record<string, string>): void;
  increment(name: string, labels: Record<string, string>): void;
}
