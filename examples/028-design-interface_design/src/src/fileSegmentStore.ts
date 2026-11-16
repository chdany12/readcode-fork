import { createReadStream } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { ByteRange, SegmentMeta, SegmentStore } from "./segmentStore";

const CONTENT_TYPES: Record<string, string> = {
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
};

export class FileSegmentStore implements SegmentStore {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error(`invalid segment key: ${key}`);
    }
    return full;
  }

  async stat(key: string): Promise<SegmentMeta | null> {
    try {
      const s = await fsStat(this.resolve(key));
      const ext = path.extname(key);
      return {
        key,
        sizeBytes: s.size,
        contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async open(key: string, range?: ByteRange): Promise<Readable> {
    const file = this.resolve(key);
    if (!range) return createReadStream(file);
    return createReadStream(file, { start: range.start, end: range.endExclusive });
  }
}
