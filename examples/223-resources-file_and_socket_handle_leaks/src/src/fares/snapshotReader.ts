import { open, readdir } from "node:fs/promises";
import path from "node:path";

export interface FareSnapshot {
  supplier: string;
  generatedAt: string;
  fares: Array<{ route: string; cabin: string; amountMinor: number; currency: string }>;
}

export class SnapshotTooLargeError extends Error {
  constructor(readonly file: string, readonly size: number) {
    super(`fare snapshot ${file} is ${size} bytes`);
    this.name = "SnapshotTooLargeError";
  }
}

const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

export async function readSnapshot(file: string): Promise<FareSnapshot> {
  const handle = await open(file, "r");
  const { size } = await handle.stat();
  if (size > MAX_SNAPSHOT_BYTES) {
    throw new SnapshotTooLargeError(file, size);
  }
  try {
    const buf = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await handle.read(buf, offset, size - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return JSON.parse(buf.subarray(0, offset).toString("utf8")) as FareSnapshot;
  } finally {
    await handle.close();
  }
}

export async function listSnapshotFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".fares.json"))
    .map((e) => path.join(dir, e.name))
    .sort();
}
