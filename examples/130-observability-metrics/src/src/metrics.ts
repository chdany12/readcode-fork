export type Labels = Record<string, string>;

function key(name: string, labels: Labels): string {
  const parts = Object.keys(labels).sort().map((k) => `${k}="${labels[k]}"`);
  return `${name}{${parts.join(",")}}`;
}

export class Counter {
  private values = new Map<string, number>();
  constructor(readonly name: string) {}
  inc(labels: Labels, by = 1): void {
    const k = key(this.name, labels);
    this.values.set(k, (this.values.get(k) ?? 0) + by);
  }
  snapshot(): Map<string, number> {
    return new Map(this.values);
  }
}

export class Gauge {
  private values = new Map<string, number>();
  constructor(readonly name: string) {}
  inc(labels: Labels): void {
    const k = key(this.name, labels);
    this.values.set(k, (this.values.get(k) ?? 0) + 1);
  }
  dec(labels: Labels): void {
    const k = key(this.name, labels);
    this.values.set(k, (this.values.get(k) ?? 0) - 1);
  }
  snapshot(): Map<string, number> {
    return new Map(this.values);
  }
}

export class Histogram {
  private series = new Map<string, { buckets: number[]; sum: number; count: number }>();
  constructor(readonly name: string, readonly bounds: number[]) {}
  observe(labels: Labels, value: number): void {
    const k = key(this.name, labels);
    let s = this.series.get(k);
    if (!s) {
      s = { buckets: this.bounds.map(() => 0), sum: 0, count: 0 };
      this.series.set(k, s);
    }
    this.bounds.forEach((b, i) => {
      if (value <= b) s!.buckets[i] += 1;
    });
    s.sum += value;
    s.count += 1;
  }
  seriesCount(): number {
    return this.series.size;
  }
}
