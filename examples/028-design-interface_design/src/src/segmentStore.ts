import { Readable } from "node:stream";

export interface ByteRange {
  start: number;
  endExclusive: number;
}

export interface SegmentMeta {
  key: string;
  sizeBytes: number;
  contentType: string;
}

export interface SegmentStore {
  stat(key: string): Promise<SegmentMeta | null>;
  open(key: string, range?: ByteRange): Promise<Readable>;
}

export class InMemorySegmentStore implements SegmentStore {
  private readonly blobs = new Map<string, { data: Buffer; contentType: string }>();

  put(key: string, data: Buffer, contentType: string): void {
    this.blobs.set(key, { data, contentType });
  }

  async stat(key: string): Promise<SegmentMeta | null> {
    const blob = this.blobs.get(key);
    if (!blob) return null;
    return { key, sizeBytes: blob.data.length, contentType: blob.contentType };
  }

  async open(key: string, range?: ByteRange): Promise<Readable> {
    const blob = this.blobs.get(key);
    if (!blob) throw new Error(`segment not found: ${key}`);
    const slice = range ? blob.data.subarray(range.start, range.endExclusive) : blob.data;
    return Readable.from([slice]);
  }
}
