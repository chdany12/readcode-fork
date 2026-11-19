import { createReadStream, createWriteStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { normalizeReading, Reading } from "./reading";

export interface IngestStats {
  accepted: number;
  rejected: number;
  bytesIn: number;
}

export interface IngestOptions {
  maxLineBytes: number;
  deviceAllowlist?: Set<string>;
}

export async function ingestBatchFile(
  sourcePath: string,
  destPath: string,
  opts: IngestOptions,
): Promise<IngestStats> {
  const stats: IngestStats = { accepted: 0, rejected: 0, bytesIn: 0 };

  const raw = createReadStream(sourcePath);
  raw.on("data", (chunk) => {
    stats.bytesIn += (chunk as Buffer).length;
  });
  const gunzip = raw.pipe(createGunzip());
  const lines = createInterface({ input: gunzip, crlfDelay: Infinity });
  const out = createWriteStream(destPath, { flags: "w" });

  const outError = new Promise<never>((_, reject) => out.once("error", reject));
  outError.catch(() => undefined);

  try {
    for await (const line of lines) {
      if (line.length === 0) continue;
      if (Buffer.byteLength(line) > opts.maxLineBytes) {
        stats.rejected++;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        stats.rejected++;
        continue;
      }

      const normalized: Reading | null = normalizeReading(parsed);
      if (!normalized) {
        stats.rejected++;
        continue;
      }
      if (opts.deviceAllowlist && !opts.deviceAllowlist.has(normalized.deviceId)) {
        stats.rejected++;
        continue;
      }

      out.write(JSON.stringify(normalized) + "\n");
      stats.accepted++;
    }
  } finally {
    lines.close();
    raw.destroy();
  }

  out.end();
  await Promise.race([once(out, "finish"), outError]);
  return stats;
}
