export const SLOT_ACCEPTED = 0;
export const SLOT_REJECTED = 1;
export const SLOT_BYTES = 2;
export const SLOT_INFLIGHT = 3;
export const SLOT_COUNT = 4;

export function createStatsBuffer(): SharedArrayBuffer {
  return new SharedArrayBuffer(SLOT_COUNT * BigInt64Array.BYTES_PER_ELEMENT);
}

export class IngestStats {
  private readonly view: BigInt64Array;

  constructor(buffer: SharedArrayBuffer) {
    this.view = new BigInt64Array(buffer);
  }

  accepted(bytes: number): void {
    Atomics.add(this.view, SLOT_ACCEPTED, 1n);
    this.view[SLOT_BYTES] += BigInt(bytes);
  }

  rejected(): void {
    Atomics.add(this.view, SLOT_REJECTED, 1n);
  }

  begin(): void {
    Atomics.add(this.view, SLOT_INFLIGHT, 1n);
  }

  end(): void {
    Atomics.sub(this.view, SLOT_INFLIGHT, 1n);
  }

  snapshot() {
    return {
      accepted: Atomics.load(this.view, SLOT_ACCEPTED),
      rejected: Atomics.load(this.view, SLOT_REJECTED),
      bytes: Atomics.load(this.view, SLOT_BYTES),
      inflight: Atomics.load(this.view, SLOT_INFLIGHT),
    };
  }

  drainCounters() {
    return {
      accepted: Atomics.exchange(this.view, SLOT_ACCEPTED, 0n),
      rejected: Atomics.exchange(this.view, SLOT_REJECTED, 0n),
      bytes: Atomics.exchange(this.view, SLOT_BYTES, 0n),
    };
  }
}
